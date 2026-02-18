import uvicorn
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends, status, Body, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func

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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)

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
        ("hardware@example.com", "Hardware"),
        ("passwordrest@example.com", "Password Reset"),
        ("software@example.com", "Software"),
        ("access@example.com", "Access"),
        ("network@example.com", "Network"),
    ]

    for email, speciality in technicians:
        if not db.query(models.User).filter(models.User.email == email).first():
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

# ---------------------------
# Auth
# ---------------------------
@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = auth.get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pw, role=user.role or "user")
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
    for t in tickets:
        t.user_email = db.query(models.User.email).filter(models.User.id == t.user_id).scalar()
        if t.technician_id:
            t.technician_email = db.query(models.User.email).filter(models.User.id == t.technician_id).scalar()
    return tickets


@app.get("/tickets", response_model=list[schemas.TicketResponse])
def get_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    tickets = db.query(models.Ticket).filter(models.Ticket.user_id == current_user.id).all()
    for t in tickets:
        t.user_email = db.query(models.User.email).filter(models.User.id == t.user_id).scalar()
        if t.technician_id:
            t.technician_email = db.query(models.User.email).filter(models.User.id == t.technician_id).scalar()
    return tickets


@app.get("/tickets/assigned", response_model=list[schemas.TicketResponse])
def get_assigned_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can view assigned tickets")

    tickets = db.query(models.Ticket).filter(models.Ticket.technician_id == current_user.id).all()
    for t in tickets:
        t.user_email = db.query(models.User.email).filter(models.User.id == t.user_id).scalar()
        t.technician_email = current_user.email
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

    ticket.user_email = db.query(models.User.email).filter(models.User.id == ticket.user_id).scalar()
    if ticket.technician_id:
        ticket.technician_email = db.query(models.User.email).filter(models.User.id == ticket.technician_id).scalar()

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

    technician = (
        db.query(models.User)
        .filter(models.User.role == "technician", models.User.speciality == predicted_category)
        .first()
    )

    db_ticket = models.Ticket(
        title=ticket.title,
        description=ticket.description,
        category=predicted_category,
        status="Open",
        user_id=current_user.id,
        technician_id=technician.id if technician else None,
        updated_at=datetime.utcnow()
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

    technician = (
        db.query(models.User)
        .filter(models.User.role == "technician", models.User.speciality == category)
        .first()
    )

    previous_technician_id = ticket.technician_id

    ticket.category = category
    ticket.technician_id = technician.id if technician else None
    ticket.updated_at = datetime.utcnow()

    if not ticket.status:
        ticket.status = "Open"

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

    return ticket


@app.get("/users", response_model=list[schemas.UserResponse])
def get_all_users(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view users")
    return db.query(models.User).all()

# ---------------------------
# Ticket Messages
# ---------------------------
@app.get("/tickets/{ticket_id}/messages", response_model=list[schemas.MessageResponse])
def get_ticket_messages(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    messages = (
        db.query(models.TicketMessage)
        .filter(models.TicketMessage.ticket_id == ticket_id)
        .all()
    )

    return [
        {
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "sender_email": msg.sender.email,
            "created_at": msg.created_at
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

    new_message = models.TicketMessage(
        content=message.content,
        sender_id=current_user.id,
        ticket_id=ticket_id,
        created_at=datetime.utcnow().isoformat()
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

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
        "created_at": new_message.created_at
    }

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    # lightweight DB check
    try:
        db.execute("SELECT 1")
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