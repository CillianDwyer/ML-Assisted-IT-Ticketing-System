import uvicorn
from datetime import datetime, timedelta
import os
import re
import uuid

from fastapi import FastAPI, HTTPException, Depends, status, Body, Path, Query, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, text, or_

import models, database, schemas, auth
from ml.ml_model import predict_category

app = FastAPI(title="IT Ticketing API")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
PRIORITY_THRESHOLDS_HOURS = {
    "low": 72,
    "medium": 48,
    "high": 24,
    "critical": 12,
}
PRIORITY_ORDER = ["Low", "Medium", "High", "Critical"]
SLA_TARGET_HOURS = {
    "Low": 72,
    "Medium": 48,
    "High": 24,
    "Critical": 12,
}
ADMIN_REVIEW_QUEUE = "Admin Review Queue"
ISSUE_TYPE_TO_TEAM = {
    "Password Reset": "Service Desk",
    "Account Lockout": "Service Desk",
    "MFA / 2FA Issue": "Service Desk",
    "Email Access Issue": "Service Desk",
    "Mailbox / Email Sync Issue": "Service Desk",
    "Software Installation Request": "Service Desk",
    "Basic Software Issue": "Service Desk",
    "Access Request": "Service Desk",
    "Laptop/Desktop Hardware Issue": "Desktop Support",
    "OS / Boot Issue": "Desktop Support",
    "Printer Issue": "Desktop Support",
    "Peripheral / Docking Issue": "Desktop Support",
    "Device Performance Issue": "Desktop Support",
    "Disk Space / Storage Issue": "Desktop Support",
    "Wi-Fi Connectivity Issue": "Network Team",
    "VPN Issue": "Network Team",
    "Network Drive Access Issue": "Network Team",
    "DNS / Network Resolution Issue": "Network Team",
    "Network Outage / Connectivity Issue": "Network Team",
    "Active Directory Issue": "Systems Team",
    "File Server Issue": "Systems Team",
    "Server Down / Service Outage": "Systems Team",
    "Backup / Restore Issue": "Systems Team",
    "VM / Infrastructure Issue": "Systems Team",
    "Phishing Report": "Security Team",
    "Malware / Virus Alert": "Security Team",
    "Suspicious Login": "Security Team",
    "Account Compromise": "Security Team",
    "Security Policy Violation": "Security Team",
}
ISSUE_TYPE_BASE_PRIORITY = {
    "Access Request": "Low",
    "Account Compromise": "Critical",
    "Account Lockout": "High",
    "Active Directory Issue": "High",
    "Backup / Restore Issue": "Medium",
    "Basic Software Issue": "Low",
    "DNS / Network Resolution Issue": "High",
    "Device Performance Issue": "Low",
    "Disk Space / Storage Issue": "Medium",
    "Email Access Issue": "Medium",
    "File Server Issue": "High",
    "Laptop/Desktop Hardware Issue": "Medium",
    "MFA / 2FA Issue": "High",
    "Mailbox / Email Sync Issue": "Medium",
    "Malware / Virus Alert": "Critical",
    "Network Drive Access Issue": "Medium",
    "Network Outage / Connectivity Issue": "Critical",
    "OS / Boot Issue": "High",
    "Password Reset": "Medium",
    "Peripheral / Docking Issue": "Low",
    "Phishing Report": "High",
    "Printer Issue": "Low",
    "Security Policy Violation": "Medium",
    "Server Down / Service Outage": "Critical",
    "Software Installation Request": "Low",
    "Suspicious Login": "High",
    "VM / Infrastructure Issue": "High",
    "VPN Issue": "High",
    "Wi-Fi Connectivity Issue": "Medium",
}
TEAM_BASE_PRIORITY = {
    ADMIN_REVIEW_QUEUE: "Medium",
    "Service Desk": "Medium",
    "Desktop Support": "Medium",
    "Network Team": "High",
    "Systems Team": "High",
    "Security Team": "High",
}


def resolve_ticket_team(category: str | None) -> str | None:
    normalized_category = (category or "").strip()
    if not normalized_category:
        return None
    if normalized_category.lower() == "uncategorized":
        return ADMIN_REVIEW_QUEUE
    return ISSUE_TYPE_TO_TEAM.get(normalized_category, normalized_category)


def ensure_ticket_message_columns():
    db = database.SessionLocal()
    try:
        cols = db.execute(text("PRAGMA table_info(ticket_messages)")).fetchall()
        col_names = {c[1] for c in cols}

        if "is_private" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE ticket_messages "
                    "ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT 0"
                )
            )

        if "recipient_id" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE ticket_messages "
                    "ADD COLUMN recipient_id INTEGER"
                )
            )

        if "attachment_name" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE ticket_messages "
                    "ADD COLUMN attachment_name VARCHAR"
                )
            )

        if "attachment_path" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE ticket_messages "
                    "ADD COLUMN attachment_path VARCHAR"
                )
            )

        if "attachment_type" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE ticket_messages "
                    "ADD COLUMN attachment_type VARCHAR"
                )
            )

        if "attachment_size" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE ticket_messages "
                    "ADD COLUMN attachment_size INTEGER"
                )
            )

        db.commit()
    finally:
        db.close()

ensure_ticket_message_columns()


def compute_ticket_priority(
    *,
    status: str | None,
    category: str | None,
    created_at: datetime | str | None
) -> str:
    if not status or status == "Closed":
        return "Low"

    created_dt = created_at
    if isinstance(created_at, str):
        try:
            created_dt = datetime.fromisoformat(created_at)
        except ValueError:
            created_dt = None

    age_hours = 0.0
    if isinstance(created_dt, datetime):
        age_hours = (datetime.utcnow() - created_dt).total_seconds() / 3600.0

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


def ensure_ticket_priority_column():
    db = database.SessionLocal()
    try:
        cols = db.execute(text("PRAGMA table_info(tickets)")).fetchall()
        col_names = {c[1] for c in cols}

        if "priority" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE tickets "
                    "ADD COLUMN priority VARCHAR NOT NULL DEFAULT 'Low'"
                )
            )
            db.commit()

        tickets = db.query(models.Ticket).all()
        for ticket in tickets:
            ticket.priority = compute_ticket_priority(
                status=ticket.status,
                category=ticket.category,
                created_at=ticket.created_at
            )
        db.commit()
    finally:
        db.close()


def ensure_ticket_team_column():
    db = database.SessionLocal()
    try:
        cols = db.execute(text("PRAGMA table_info(tickets)")).fetchall()
        col_names = {c[1] for c in cols}

        if "team" not in col_names:
            db.execute(
                text(
                    "ALTER TABLE tickets "
                    "ADD COLUMN team VARCHAR NOT NULL DEFAULT 'Unassigned'"
                )
            )
            db.commit()

        tickets = db.query(models.Ticket).all()
        for ticket in tickets:
            ticket.team = resolve_ticket_team(ticket.category) or "Unassigned"
        db.commit()
    finally:
        db.close()


ensure_ticket_team_column()


ensure_ticket_priority_column()


def refresh_ticket_priority(ticket: models.Ticket) -> bool:
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
    if ticket.status == "Closed":
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

    age_hours = (datetime.utcnow() - created_at).total_seconds() / 3600.0
    ratio = age_hours / target_hours if target_hours > 0 else 0

    if ratio >= 1.0:
        return "breached"
    if ratio >= 0.75:
        return "at_risk"
    return "on_track"


def set_ticket_sla_state(ticket: models.Ticket):
    ticket.sla_state = compute_ticket_sla_state(ticket)

# ---------------------------
# DB Dependency
# ---------------------------
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------
# Seed users
# ---------------------------
def seed_default_users():
    db = database.SessionLocal()
    admin_email = "admin@example.com"

    if not db.query(models.User).filter(models.User.email == admin_email).first():
        admin_user = models.User(
            email=admin_email,
            hashed_password=auth.get_password_hash("admin123"),
            role="admin"
        )
        db.add(admin_user)

    technicians = [
        ("servicedesk@example.com", "Service Desk"),
        ("desktopsupport@example.com", "Desktop Support"),
        ("networkteam@example.com", "Network Team"),
        ("systemsteam@example.com", "Systems Team"),
        ("securityteam@example.com", "Security Team"),
    ]

    for email, speciality in technicians:
        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            existing.role = "technician"
            existing.speciality = speciality
            continue
        if not existing:
            tech = models.User(
                email=email,
                hashed_password=auth.get_password_hash("tech123"),
                role="technician",
                speciality=speciality
            )
            db.add(tech)

    db.commit()
    db.close()

seed_default_users()


def cleanup_legacy_technician_accounts():
    db = database.SessionLocal()
    try:
        legacy_mapping = {
            "hardware@example.com": "desktopsupport@example.com",
            "passwordrest@example.com": "servicedesk@example.com",
            "software@example.com": "servicedesk@example.com",
            "access@example.com": "systemsteam@example.com",
            "network@example.com": "networkteam@example.com",
        }
        changed = False
        for legacy_email, canonical_email in legacy_mapping.items():
            legacy_user = db.query(models.User).filter(models.User.email == legacy_email).first()
            canonical_user = db.query(models.User).filter(models.User.email == canonical_email).first()
            if not legacy_user:
                continue
            if canonical_user is None:
                continue

            if legacy_user.id == canonical_user.id:
                continue

            (
                db.query(models.Ticket)
                .filter(models.Ticket.technician_id == legacy_user.id)
                .update({"technician_id": canonical_user.id}, synchronize_session=False)
            )
            (
                db.query(models.Notification)
                .filter(models.Notification.user_id == legacy_user.id)
                .update({"user_id": canonical_user.id}, synchronize_session=False)
            )
            (
                db.query(models.TicketMessage)
                .filter(models.TicketMessage.recipient_id == legacy_user.id)
                .update({"recipient_id": canonical_user.id}, synchronize_session=False)
            )

            db.delete(legacy_user)
            changed = True

        if changed:
            db.commit()
    finally:
        db.close()


cleanup_legacy_technician_accounts()

# ---------------------------
# Helpers: Notifications
# ---------------------------
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


def can_access_ticket(ticket: models.Ticket, user: models.User) -> bool:
    if user.role == "admin":
        return True
    if user.role == "user":
        return ticket.user_id == user.id
    if user.role == "technician":
        return ticket.technician_id == user.id
    return False


def extract_mentioned_email(text_content: str) -> str | None:
    if not text_content:
        return None

    # Supports "please check @tech@example.com"
    match = re.search(r"@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", text_content)
    if not match:
        return None
    return match.group(1).lower()


def save_message_attachment(ticket_id: int, file: UploadFile) -> tuple[str, str, str | None, int]:
    safe_name = os.path.basename(file.filename or "attachment")
    ext = os.path.splitext(safe_name)[1]
    stored_name = f"{ticket_id}_{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, stored_name)

    content = file.file.read()
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(status_code=400, detail="Attachment exceeds 10MB limit")
    with open(dest_path, "wb") as out:
        out.write(content)

    return safe_name, dest_path, file.content_type, len(content)

# ---------------------------
# Auth
# ---------------------------
@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = auth.get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth.get_password_hash(user.password)
    # Public registration is always a regular user.
    # Admin/technician demo users are seeded separately.
    new_user = models.User(email=user.email, hashed_password=hashed_pw, role="user")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.get_user_by_email(db, form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = auth.create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "role": user.role}
    }

# ---------------------------
# Notifications
# ---------------------------
@app.get("/notifications/unread-count")
def get_unread_notification_count(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False
        )
        .count()
    )
    return {"count": count}


@app.get("/notifications", response_model=list[schemas.NotificationResponse])
def list_notifications(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20
):
    notifs = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    return notifs


@app.put("/notifications/{notification_id}/read", response_model=schemas.NotificationResponse)
def mark_notification_read(
    notification_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    notif = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id
        )
        .first()
    )
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@app.put("/notifications/read-all")
def mark_all_notifications_read(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False
        )
        .update({"is_read": True})
    )
    db.commit()
    return {"success": True}

# ---------------------------
# ✅ Admin Stats (NEW)
# ---------------------------
@app.get("/admin/stats")
def admin_stats(
    days: int = Query(14, ge=1, le=365),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    total = db.query(models.Ticket).count()
    open_count = db.query(models.Ticket).filter(models.Ticket.status == "Open").count()
    inprog_count = db.query(models.Ticket).filter(models.Ticket.status == "In Progress").count()
    closed_count = db.query(models.Ticket).filter(models.Ticket.status == "Closed").count()

    assigned = db.query(models.Ticket).filter(models.Ticket.technician_id.isnot(None)).count()
    unassigned = db.query(models.Ticket).filter(models.Ticket.technician_id.is_(None)).count()

    # Avg resolution time (hours) for closed tickets (SQLite strftime trick)
    avg_resolution_hours = db.query(
        func.avg(
            (func.strftime('%s', models.Ticket.closed_at) - func.strftime('%s', models.Ticket.created_at)) / 3600.0
        )
    ).filter(models.Ticket.closed_at.isnot(None)).scalar()

    start = datetime.utcnow() - timedelta(days=days)

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
        .filter(models.Ticket.status != "Closed")
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

# ---------------------------
# Tickets - Views
# ---------------------------
@app.get("/tickets/all", response_model=list[schemas.TicketResponse])
def get_all_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view all tickets")

    tickets = db.query(models.Ticket).all()
    changed = False
    for t in tickets:
        changed = refresh_ticket_priority(t) or changed
        set_ticket_sla_state(t)
        t.user_email = db.query(models.User.email).filter(models.User.id == t.user_id).scalar()
        if t.technician_id:
            t.technician_email = db.query(models.User.email).filter(models.User.id == t.technician_id).scalar()
    if changed:
        db.commit()
    return tickets


@app.get("/tickets", response_model=list[schemas.TicketResponse])
def get_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    tickets = db.query(models.Ticket).filter(models.Ticket.user_id == current_user.id).all()
    changed = False
    for t in tickets:
        changed = refresh_ticket_priority(t) or changed
        set_ticket_sla_state(t)
        t.user_email = db.query(models.User.email).filter(models.User.id == t.user_id).scalar()
        if t.technician_id:
            t.technician_email = db.query(models.User.email).filter(models.User.id == t.technician_id).scalar()
    if changed:
        db.commit()
    return tickets


@app.get("/tickets/assigned", response_model=list[schemas.TicketResponse])
def get_assigned_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can view assigned tickets")

    tickets = db.query(models.Ticket).filter(models.Ticket.technician_id == current_user.id).all()
    changed = False
    for t in tickets:
        changed = refresh_ticket_priority(t) or changed
        set_ticket_sla_state(t)
        t.user_email = db.query(models.User.email).filter(models.User.id == t.user_id).scalar()
        t.technician_email = current_user.email
    if changed:
        db.commit()
    return tickets


@app.get("/tickets/{ticket_id}", response_model=schemas.TicketResponse)
def get_ticket_by_id(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user.role == "user" and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == "technician" and ticket.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    changed = refresh_ticket_priority(ticket)
    set_ticket_sla_state(ticket)
    ticket.user_email = db.query(models.User.email).filter(models.User.id == ticket.user_id).scalar()
    if ticket.technician_id:
        ticket.technician_email = db.query(models.User.email).filter(models.User.id == ticket.technician_id).scalar()
    if changed:
        db.commit()

    return ticket

# ---------------------------
# Tickets - Create / Assign / Update
# ---------------------------
@app.post("/tickets", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    predicted_category = predict_category(ticket.description)
    predicted_team = resolve_ticket_team(predicted_category)
    now = datetime.utcnow()

    technician = (
        db.query(models.User)
        .filter(models.User.role == "technician", models.User.speciality == predicted_team)
        .first()
    )

    db_ticket = models.Ticket(
        title=ticket.title,
        description=ticket.description,
        category=predicted_category,
        team=predicted_team or "Unassigned",
        status="Open",
        priority=compute_ticket_priority(
            status="Open",
            category=predicted_category,
            created_at=now
        ),
        user_id=current_user.id,
        technician_id=technician.id if technician else None,
        created_at=now,
        updated_at=now
    )

    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)

    if db_ticket.technician_id:
        create_notification(
            db,
            user_id=db_ticket.technician_id,
            type="assignment",
            content=f"New ticket assigned: #{db_ticket.id} — {db_ticket.title}",
            ticket_id=db_ticket.id
        )
        db.commit()
    else:
        notify_admins_about_unassigned_ticket(db, db_ticket)
        db.commit()

    set_ticket_sla_state(db_ticket)
    return db_ticket


@app.put("/tickets/{ticket_id}/assign/{technician_id}", response_model=schemas.TicketResponse)
def assign_ticket(
    ticket_id: int,
    technician_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    tech = db.query(models.User).filter(models.User.id == technician_id, models.User.role == "technician").first()
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")

    ticket.technician_id = technician_id
    ticket.updated_at = datetime.utcnow()
    ticket.priority = compute_ticket_priority(
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at
    )

    if not ticket.status:
        ticket.status = "Open"

    db.commit()
    db.refresh(ticket)

    create_notification(
        db,
        user_id=technician_id,
        type="assignment",
        content=f"Ticket assigned to you: #{ticket.id} — {ticket.title}",
        ticket_id=ticket.id
    )
    db.commit()

    set_ticket_sla_state(ticket)
    return ticket


@app.put("/tickets/{ticket_id}/status", response_model=schemas.TicketResponse)
def update_ticket_status(
    ticket_id: int = Path(..., description="ID of the ticket to update"),
    status: str = Body(..., embed=True, description="New ticket status"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user.role == "technician" and ticket.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this ticket")
    if current_user.role not in ["technician", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    allowed_statuses = {"Open", "In Progress", "Closed"}
    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    ticket.status = status
    ticket.updated_at = datetime.utcnow()
    if status == "Closed":
        ticket.closed_at = datetime.utcnow()
    else:
        ticket.closed_at = None
    ticket.priority = compute_ticket_priority(
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at
    )

    db.commit()
    db.refresh(ticket)

    recipients = set()
    if ticket.user_id and ticket.user_id != current_user.id:
        recipients.add(ticket.user_id)
    if ticket.technician_id and ticket.technician_id != current_user.id:
        recipients.add(ticket.technician_id)

    for uid in recipients:
        create_notification(
            db,
            user_id=uid,
            type="status",
            content=f"Ticket #{ticket.id} status updated to '{ticket.status}'",
            ticket_id=ticket.id
        )
    if recipients:
        db.commit()

    set_ticket_sla_state(ticket)
    return ticket


@app.put("/tickets/{ticket_id}/category", response_model=schemas.TicketResponse)
def update_ticket_category(
    ticket_id: int,
    category: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user.role == "technician" and ticket.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this ticket")
    if current_user.role not in ["technician", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    mapped_team = resolve_ticket_team(category)
    technician = (
        db.query(models.User)
        .filter(models.User.role == "technician", models.User.speciality == mapped_team)
        .first()
    )

    previous_technician_id = ticket.technician_id

    ticket.category = category
    ticket.team = mapped_team or "Unassigned"
    ticket.technician_id = technician.id if technician else None
    ticket.updated_at = datetime.utcnow()

    if not ticket.status:
        ticket.status = "Open"
    ticket.priority = compute_ticket_priority(
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at
    )

    db.commit()
    db.refresh(ticket)

    if ticket.technician_id and ticket.technician_id != previous_technician_id:
        create_notification(
            db,
            user_id=ticket.technician_id,
            type="assignment",
            content=f"Ticket assigned to you: #{ticket.id} — {ticket.title}",
            ticket_id=ticket.id
        )
        db.commit()

    set_ticket_sla_state(ticket)
    return ticket


@app.get("/users", response_model=list[schemas.UserResponse])
def get_all_users(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view users")
    return db.query(models.User).all()


@app.get("/tickets/{ticket_id}/assist-users", response_model=list[schemas.UserResponse])
def get_assist_users(
    ticket_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_access_ticket(ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role not in ["technician", "admin"]:
        raise HTTPException(status_code=403, detail="Only technicians/admins can send private assistance messages")

    return (
        db.query(models.User)
        .filter(
            models.User.role.in_(["technician", "admin"]),
            models.User.id != current_user.id
        )
        .all()
    )

# ---------------------------
# Ticket Messages
# ---------------------------
@app.get("/tickets/{ticket_id}/messages", response_model=list[schemas.MessageResponse])
def get_ticket_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_access_ticket(ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    query = db.query(models.TicketMessage).filter(models.TicketMessage.ticket_id == ticket_id)
    if current_user.role != "admin":
        query = query.filter(
            or_(
                models.TicketMessage.is_private == False,
                models.TicketMessage.sender_id == current_user.id,
                models.TicketMessage.recipient_id == current_user.id
            )
        )

    messages = query.order_by(models.TicketMessage.id.asc()).all()

    return [
        {
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "sender_email": msg.sender.email,
            "created_at": msg.created_at,
            "is_private": bool(msg.is_private),
            "recipient_email": msg.recipient.email if msg.recipient else None,
            "attachment_name": msg.attachment_name,
            "attachment_type": msg.attachment_type,
            "attachment_size": msg.attachment_size
        }
        for msg in messages
    ]


@app.post("/tickets/{ticket_id}/messages", response_model=schemas.MessageResponse)
def add_ticket_message(
    ticket_id: int,
    message: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_access_ticket(ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    text_content = (message.content or "").strip()
    if not text_content:
        raise HTTPException(status_code=400, detail="Message content is required")

    mentioned_email = extract_mentioned_email(text_content)
    target_email = (message.private_to_email.lower() if message.private_to_email else None) or mentioned_email

    recipient = None
    is_private = False

    if target_email:
        if current_user.role not in ["technician", "admin"]:
            raise HTTPException(status_code=403, detail="Only technicians/admins can send private assistance messages")

        recipient = (
            db.query(models.User)
            .filter(
                models.User.email == target_email,
                models.User.role.in_(["technician", "admin"])
            )
            .first()
        )
        if not recipient:
            raise HTTPException(status_code=404, detail="Private recipient must be an existing technician/admin email")
        if recipient.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot send private message to yourself")

        is_private = True

    new_message = models.TicketMessage(
        content=text_content,
        sender_id=current_user.id,
        ticket_id=ticket_id,
        created_at=datetime.utcnow().isoformat(),
        is_private=is_private,
        recipient_id=recipient.id if recipient else None,
        attachment_name=None,
        attachment_path=None,
        attachment_type=None,
        attachment_size=None
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    if is_private and recipient and recipient.id != current_user.id:
        create_notification(
            db,
            user_id=recipient.id,
            type="message",
            content=f"Private assist message on ticket #{ticket.id}: {ticket.title}",
            ticket_id=ticket.id
        )
        db.commit()
    else:
        recipients = set()
        if ticket.user_id and ticket.user_id != current_user.id:
            recipients.add(ticket.user_id)
        if ticket.technician_id and ticket.technician_id != current_user.id:
            recipients.add(ticket.technician_id)

        for uid in recipients:
            create_notification(
                db,
                user_id=uid,
                type="message",
                content=f"New message on ticket #{ticket.id}: {ticket.title}",
                ticket_id=ticket.id
            )
        if recipients:
            db.commit()

    return {
        "id": new_message.id,
        "content": new_message.content,
        "sender_id": new_message.sender_id,
        "sender_email": current_user.email,
        "created_at": new_message.created_at,
        "is_private": bool(new_message.is_private),
        "recipient_email": recipient.email if recipient else None,
        "attachment_name": new_message.attachment_name,
        "attachment_type": new_message.attachment_type,
        "attachment_size": new_message.attachment_size
    }


@app.post("/tickets/{ticket_id}/messages/upload", response_model=schemas.MessageResponse)
def add_ticket_message_with_attachment(
    ticket_id: int,
    content: str | None = Form(None),
    private_to_email: str | None = Form(None),
    attachment: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_access_ticket(ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    text_content = (content or "").strip()
    if not text_content and attachment is None:
        raise HTTPException(status_code=400, detail="Message must include text or attachment")

    target_email = (private_to_email.lower().strip() if private_to_email else None) or extract_mentioned_email(text_content)
    recipient = None
    is_private = False

    if target_email:
        if current_user.role not in ["technician", "admin"]:
            raise HTTPException(status_code=403, detail="Only technicians/admins can send private assistance messages")
        recipient = (
            db.query(models.User)
            .filter(
                models.User.email == target_email,
                models.User.role.in_(["technician", "admin"])
            )
            .first()
        )
        if not recipient:
            raise HTTPException(status_code=404, detail="Private recipient must be an existing technician/admin email")
        if recipient.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot send private message to yourself")
        is_private = True

    attachment_name = None
    attachment_path = None
    attachment_type = None
    attachment_size = None
    if attachment is not None:
        attachment_name, attachment_path, attachment_type, attachment_size = save_message_attachment(ticket_id, attachment)

    new_message = models.TicketMessage(
        content=text_content,
        sender_id=current_user.id,
        ticket_id=ticket_id,
        created_at=datetime.utcnow().isoformat(),
        is_private=is_private,
        recipient_id=recipient.id if recipient else None,
        attachment_name=attachment_name,
        attachment_path=attachment_path,
        attachment_type=attachment_type,
        attachment_size=attachment_size
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    if is_private and recipient and recipient.id != current_user.id:
        create_notification(
            db,
            user_id=recipient.id,
            type="message",
            content=f"Private assist message on ticket #{ticket.id}: {ticket.title}",
            ticket_id=ticket.id
        )
        db.commit()
    else:
        recipients = set()
        if ticket.user_id and ticket.user_id != current_user.id:
            recipients.add(ticket.user_id)
        if ticket.technician_id and ticket.technician_id != current_user.id:
            recipients.add(ticket.technician_id)
        for uid in recipients:
            create_notification(
                db,
                user_id=uid,
                type="message",
                content=f"New message on ticket #{ticket.id}: {ticket.title}",
                ticket_id=ticket.id
            )
        if recipients:
            db.commit()

    return {
        "id": new_message.id,
        "content": new_message.content,
        "sender_id": new_message.sender_id,
        "sender_email": current_user.email,
        "created_at": new_message.created_at,
        "is_private": bool(new_message.is_private),
        "recipient_email": recipient.email if recipient else None,
        "attachment_name": new_message.attachment_name,
        "attachment_type": new_message.attachment_type,
        "attachment_size": new_message.attachment_size
    }


@app.get("/tickets/{ticket_id}/messages/{message_id}/attachment")
def download_message_attachment(
    ticket_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_access_ticket(ticket, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")

    message = (
        db.query(models.TicketMessage)
        .filter(
            models.TicketMessage.id == message_id,
            models.TicketMessage.ticket_id == ticket_id
        )
        .first()
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if not message.attachment_path or not os.path.exists(message.attachment_path):
        raise HTTPException(status_code=404, detail="Attachment not found")

    return FileResponse(
        path=message.attachment_path,
        filename=message.attachment_name or "attachment",
        media_type=message.attachment_type or "application/octet-stream"
    )

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    # lightweight DB check
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception:
        return {"status": "degraded", "db": "error"}
    
@app.get("/public/metrics")
def public_metrics(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    # Active tickets: anything not closed
    active_tickets = (
        db.query(models.Ticket)
        .filter(models.Ticket.status != "Closed")
        .count()
    )

    # Avg resolution time in hours for tickets closed in the last N days
    start = datetime.utcnow() - timedelta(days=days)

    avg_resolution_hours = db.query(
        func.avg(
            (func.strftime('%s', models.Ticket.closed_at) - func.strftime('%s', models.Ticket.created_at)) / 3600.0
        )
    ).filter(
        models.Ticket.closed_at.isnot(None),
        models.Ticket.closed_at >= start
    ).scalar()

    # Optional: simple breakdown (still safe / aggregate)
    by_status_rows = (
        db.query(models.Ticket.status, func.count(models.Ticket.id))
        .group_by(models.Ticket.status)
        .all()
    )
    by_status = {status: count for status, count in by_status_rows}

    return {
        "active_tickets": active_tickets,
        "avg_resolution_hours": float(avg_resolution_hours) if avg_resolution_hours is not None else None,
        "window_days": days,
        "by_status": by_status,
        "last_updated": datetime.utcnow().isoformat()
    }


@app.get("/")
def read_root():
    return {"message": "Welcome to the Machine Learning-Based IT Ticketing System API"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
