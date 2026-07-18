# ticket_logic.py
# Domain logic shared by the ticket/message routers: team routing,
# priority escalation, SLA state, technician selection and access control.

import re
from datetime import datetime

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

import models
from constants import (
    ADMIN_REVIEW_QUEUE,
    ISSUE_TYPE_BASE_PRIORITY,
    ISSUE_TYPE_TO_TEAM,
    PRIORITY_ORDER,
    PRIORITY_THRESHOLDS_HOURS,
    SLA_TARGET_HOURS,
    STATUS_CLOSED,
    TEAM_BASE_PRIORITY,
)
from timeutils import utcnow


def resolve_ticket_team(category: str | None) -> str | None:
    # Converts an issue type into the owning support team.
    normalized_category = (category or "").strip()
    if not normalized_category:
        return None
    if normalized_category.lower() == "uncategorized":
        return ADMIN_REVIEW_QUEUE
    return ISSUE_TYPE_TO_TEAM.get(normalized_category, normalized_category)


def compute_ticket_priority(
    *,
    status: str | None,
    category: str | None,
    created_at: datetime | str | None
) -> str:
    # Closed tickets are treated as no longer urgent.
    if not status or status == STATUS_CLOSED:
        return "Low"

    created_dt = created_at
    if isinstance(created_at, str):
        try:
            created_dt = datetime.fromisoformat(created_at)
        except ValueError:
            created_dt = None

    age_hours = 0.0
    if isinstance(created_dt, datetime):
        age_hours = (utcnow() - created_dt).total_seconds() / 3600.0

    normalized_category = (category or "").strip()
    priority = ISSUE_TYPE_BASE_PRIORITY.get(normalized_category)
    if priority is None:
        priority = TEAM_BASE_PRIORITY.get(resolve_ticket_team(category), "Low")

    # Age-based escalation.
    if age_hours >= PRIORITY_THRESHOLDS_HOURS["low"]:
        return "Critical"

    base_idx = PRIORITY_ORDER.index(priority)
    if age_hours >= PRIORITY_THRESHOLDS_HOURS["medium"]:
        return PRIORITY_ORDER[min(base_idx + 2, len(PRIORITY_ORDER) - 1)]
    if age_hours >= PRIORITY_THRESHOLDS_HOURS["high"]:
        return PRIORITY_ORDER[min(base_idx + 1, len(PRIORITY_ORDER) - 1)]
    if age_hours >= PRIORITY_THRESHOLDS_HOURS["critical"] and priority == "High":
        return "Critical"
    return priority


def refresh_ticket_priority(ticket: models.Ticket) -> bool:
    # Recomputes priority after a ticket changes and reports whether it changed.
    computed = compute_ticket_priority(
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at
    )
    if ticket.priority != computed:
        ticket.priority = computed
        return True
    return False


def compute_ticket_sla_state(ticket: models.Ticket) -> str:
    # Converts ticket age vs target window into a simple SLA label.
    if ticket.status == STATUS_CLOSED:
        return "met"

    created_at = ticket.created_at
    if not isinstance(created_at, datetime):
        return "on_track"

    effective_priority = ticket.priority or compute_ticket_priority(
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at
    )
    target_hours = SLA_TARGET_HOURS.get(effective_priority, 48)

    age_hours = (utcnow() - created_at).total_seconds() / 3600.0
    ratio = age_hours / target_hours if target_hours > 0 else 0

    if ratio >= 1.0:
        return "breached"
    if ratio >= 0.75:
        return "at_risk"
    return "on_track"


def set_ticket_sla_state(ticket: models.Ticket):
    # Attached dynamically for API responses and frontend display.
    ticket.sla_state = compute_ticket_sla_state(ticket)


def pick_technician_for_team(db: Session, team: str | None) -> models.User | None:
    # Least-loaded assignment: the matching technician with the fewest
    # open tickets gets the next one (ties broken by id for determinism).
    if not team:
        return None
    return (
        db.query(models.User)
        .outerjoin(
            models.Ticket,
            and_(
                models.Ticket.technician_id == models.User.id,
                models.Ticket.status != STATUS_CLOSED,
            ),
        )
        .filter(models.User.role == "technician", models.User.speciality == team)
        .group_by(models.User.id)
        .order_by(func.count(models.Ticket.id).asc(), models.User.id.asc())
        .first()
    )


def prepare_tickets_for_response(db: Session, tickets: list[models.Ticket]):
    # Refreshes age-based priority (persisting any escalations), computes SLA
    # state and attaches owner/technician emails for the API response.
    changed = False
    for t in tickets:
        if refresh_ticket_priority(t):
            changed = True
        set_ticket_sla_state(t)
        t.user_email = t.owner.email if t.owner else None
        t.technician_email = t.technician.email if t.technician else None
    if changed:
        db.commit()
    return tickets


def is_private_assist_participant(db: Session, ticket_id: int, user_id: int) -> bool:
    # Technicians can access tickets where they are part of a private assist exchange.
    return (
        db.query(models.TicketMessage.id)
        .filter(
            models.TicketMessage.ticket_id == ticket_id,
            models.TicketMessage.is_private == True,
            or_(
                models.TicketMessage.sender_id == user_id,
                models.TicketMessage.recipient_id == user_id,
            )
        )
        .first()
        is not None
    )


def can_access_ticket(ticket: models.Ticket, user: models.User, db: Session | None = None) -> bool:
    # Central ticket-access rule used across ticket and messaging endpoints.
    if user.role == "admin":
        return True
    if user.role == "user":
        return ticket.user_id == user.id
    if user.role == "technician":
        if ticket.technician_id == user.id:
            return True
        return db is not None and is_private_assist_participant(db, ticket.id, user.id)
    return False


def extract_mentioned_email(text_content: str) -> str | None:
    # Supports private assist targeting via @email mentions inside message text.
    if not text_content:
        return None

    # Supports "please check @tech@example.com"
    match = re.search(r"@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", text_content)
    if not match:
        return None
    return match.group(1).lower()
