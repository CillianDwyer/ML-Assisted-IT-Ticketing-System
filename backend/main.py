import uvicorn
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Depends, status, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

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

    # Role-based authorization
    if current_user.role == "user" and ticket.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.role == "technician" and ticket.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Populate emails
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

    # ✅ Status should only be: Open, In Progress, Closed
    # Assignment is represented by technician_id, not a separate "Assigned" status.
    db_ticket = models.Ticket(
        title=ticket.title,
        description=ticket.description,
        category=predicted_category,
        status="Open",
        user_id=current_user.id,
        technician_id=technician.id if technician else None
    )

    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
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

    # ✅ Do NOT set status="Assigned"
    # Keep existing status; if missing, default to Open.
    if not ticket.status:
        ticket.status = "Open"

    db.commit()
    db.refresh(ticket)
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

    # Admin can update any; technician only their assigned
    if current_user.role == "technician" and ticket.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this ticket")
    if current_user.role not in ["technician", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # ✅ Enforce only these statuses
    allowed_statuses = {"Open", "In Progress", "Closed"}
    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    ticket.status = status
    db.commit()
    db.refresh(ticket)
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

    # Authorization
    if current_user.role == "technician" and ticket.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not assigned to this ticket")
    if current_user.role not in ["technician", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Re-route ticket based on new category
    technician = (
        db.query(models.User)
        .filter(models.User.role == "technician", models.User.speciality == category)
        .first()
    )

    ticket.category = category
    ticket.technician_id = technician.id if technician else None

    # ✅ Do NOT set status="Assigned"
    # Keep existing status; if missing, default to Open.
    if not ticket.status:
        ticket.status = "Open"

    db.commit()
    db.refresh(ticket)
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
    new_message = models.TicketMessage(
        content=message.content,
        sender_id=current_user.id,
        ticket_id=ticket_id,
        created_at=datetime.utcnow().isoformat()
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return {
        "id": new_message.id,
        "content": new_message.content,
        "sender_id": new_message.sender_id,
        "sender_email": current_user.email,
        "created_at": new_message.created_at
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to the Machine Learning-Based IT Ticketing System API"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
