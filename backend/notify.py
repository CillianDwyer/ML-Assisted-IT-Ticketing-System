# notify.py
# Notification creation helpers so events are created consistently.

from sqlalchemy.orm import Session

import models


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    content: str,
    ticket_id: int | None = None
):
    notif = models.Notification(
        user_id=user_id,
        type=type,
        content=content,
        ticket_id=ticket_id,
        is_read=False
    )
    db.add(notif)
    return notif


def notify_admins_about_unassigned_ticket(db: Session, ticket: models.Ticket):
    # Unassigned or uncategorized tickets are surfaced to admins for review.
    admin_ids = [
        user_id
        for (user_id,) in (
            db.query(models.User.id)
            .filter(models.User.role == "admin")
            .all()
        )
    ]

    for admin_id in admin_ids:
        create_notification(
            db,
            user_id=admin_id,
            type="assignment",
            content=f"Unassigned ticket needs review: #{ticket.id} — {ticket.title}",
            ticket_id=ticket.id
        )


def notify_ticket_participants(
    db: Session,
    ticket: models.Ticket,
    actor_id: int,
    type: str,
    content: str
) -> bool:
    # Notifies the ticket owner and assigned technician, excluding whoever acted.
    recipients = set()
    if ticket.user_id and ticket.user_id != actor_id:
        recipients.add(ticket.user_id)
    if ticket.technician_id and ticket.technician_id != actor_id:
        recipients.add(ticket.technician_id)

    for uid in recipients:
        create_notification(
            db,
            user_id=uid,
            type=type,
            content=content,
            ticket_id=ticket.id
        )
    return bool(recipients)
