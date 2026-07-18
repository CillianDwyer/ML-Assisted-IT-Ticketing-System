# routers/admin.py
# Admin-only analytics for the dashboard.

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import auth
import models
from constants import STATUS_CLOSED, STATUS_IN_PROGRESS, STATUS_OPEN
from database import get_db
from timeutils import utcnow

router = APIRouter(tags=["admin"])


@router.get("/admin/stats")
def admin_stats(
    days: int = Query(14, ge=1, le=365),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    total = db.query(models.Ticket).count()
    open_count = db.query(models.Ticket).filter(models.Ticket.status == STATUS_OPEN).count()
    inprog_count = db.query(models.Ticket).filter(models.Ticket.status == STATUS_IN_PROGRESS).count()
    closed_count = db.query(models.Ticket).filter(models.Ticket.status == STATUS_CLOSED).count()

    assigned = db.query(models.Ticket).filter(models.Ticket.technician_id.isnot(None)).count()
    unassigned = db.query(models.Ticket).filter(models.Ticket.technician_id.is_(None)).count()

    # Avg resolution time (hours) for closed tickets (SQLite strftime trick)
    avg_resolution_hours = db.query(
        func.avg(
            (func.strftime('%s', models.Ticket.closed_at) - func.strftime('%s', models.Ticket.created_at)) / 3600.0
        )
    ).filter(models.Ticket.closed_at.isnot(None)).scalar()

    start = utcnow() - timedelta(days=days)

    per_day_rows = (
        db.query(
            func.strftime('%Y-%m-%d', models.Ticket.created_at).label("day"),
            func.count(models.Ticket.id).label("count")
        )
        .filter(models.Ticket.created_at >= start)
        .group_by("day")
        .order_by("day")
        .all()
    )
    tickets_per_day = [{"day": r.day, "count": r.count} for r in per_day_rows]

    status_rows = (
        db.query(models.Ticket.status, func.count(models.Ticket.id))
        .group_by(models.Ticket.status)
        .all()
    )
    by_status = {status: count for status, count in status_rows}

    category_rows = (
        db.query(models.Ticket.category, func.count(models.Ticket.id))
        .group_by(models.Ticket.category)
        .all()
    )
    by_category = {cat: count for cat, count in category_rows}

    team_rows = (
        db.query(models.Ticket.team, func.count(models.Ticket.id))
        .group_by(models.Ticket.team)
        .all()
    )
    by_team = {team: count for team, count in team_rows}

    tech_rows = (
        db.query(models.User.email, func.count(models.Ticket.id))
        .join(models.Ticket, models.Ticket.technician_id == models.User.id, isouter=True)
        .filter(models.User.role == "technician")
        .group_by(models.User.email)
        .all()
    )
    by_technician = [{"technician": email, "count": count} for email, count in tech_rows]

    oldest_open = (
        db.query(models.Ticket)
        .filter(models.Ticket.status != STATUS_CLOSED)
        .order_by(models.Ticket.created_at.asc())
        .limit(5)
        .all()
    )
    oldest_open_simple = [
        {"id": t.id, "title": t.title, "status": t.status, "created_at": t.created_at}
        for t in oldest_open
    ]

    return {
        "overview": {
            "total": total,
            "open": open_count,
            "in_progress": inprog_count,
            "closed": closed_count,
            "assigned": assigned,
            "unassigned": unassigned,
            "avg_resolution_hours": float(avg_resolution_hours) if avg_resolution_hours is not None else None,
        },
        "tickets_per_day": tickets_per_day,
        "by_status": by_status,
        "by_category": by_category,
        "by_team": by_team,
        "by_technician": by_technician,
        "oldest_open": oldest_open_simple,
    }
