import uvicorn
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from fastapi import Body
from auth import get_password_hash
from fastapi import Path
from ml.ml_model import predict_category



import models, database, schemas, auth

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

# Create default admin and technician users
from auth import get_password_hash

def seed_default_users():
    db = database.SessionLocal()
    admin_email = "admin@example.com"
    tech_email = "tech@example.com"

    # Admin account
    if not db.query(models.User).filter(models.User.email == admin_email).first():
        admin_user = models.User(
            email=admin_email,
            hashed_password=get_password_hash("admin123"),  # password: admin123
            role="admin"
        )
        db.add(admin_user)

    # Technician account
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
                hashed_password=get_password_hash("tech123"),
                role="technician",
                speciality=speciality
            )
            db.add(tech)

    db.commit()
    db.close()

seed_default_users()


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = auth.get_user_by_email(db, user.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = auth.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_pw)
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
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role  # Added role here
        }
    }


# Admin route: get all tickets
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

#Technician: view tickets assigned to them
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

# Technician updates ticket status
@app.put("/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: int = Path(..., description="ID of the ticket to update"),
    status: str = Body(..., embed=True, description="New ticket status"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Only technicians (or admins) can update statuses
    if current_user.role not in ["technician", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to update status")

    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # If technician, ensure it's assigned to them
    if current_user.role == "technician" and ticket.technician_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this ticket")

    ticket.status = status
    db.commit()
    db.refresh(ticket)
    return {"message": f"Ticket {ticket.id} status updated to {status}"}

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

    # 🔐 Authorization
    if current_user.role == "admin":
        pass
    elif current_user.role == "technician":
        if ticket.technician_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this ticket")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 🔁 Re-route ticket if category changes
    technician = (
        db.query(models.User)
        .filter(
            models.User.role == "technician",
            models.User.speciality == category
        )
        .first()
    )

    ticket.category = category
    ticket.technician_id = technician.id if technician else None
    ticket.status = "Assigned" if technician else "Open"

    db.commit()
    db.refresh(ticket)
    return ticket



@app.post("/tickets", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 🔹 ML prediction
    predicted_category = predict_category(ticket.description)


    # 🔹 Find available technician for category
    technician = (
        db.query(models.User)
        .filter(
            models.User.role == "technician",
            models.User.speciality == predicted_category
        )
        .first()
    )

    db_ticket = models.Ticket(
        title=ticket.title,
        description=ticket.description,
        category=predicted_category,
        status="Assigned" if technician else "Open",
        user_id=current_user.id,
        technician_id=technician.id if technician else None
    )


    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket


# Assign a ticket to a technician (admin only)
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
    ticket.status = "Assigned"
    db.commit()
    db.refresh(ticket)
    return ticket


# Technician updates ticket status
@app.put("/tickets/{ticket_id}/status", response_model=schemas.TicketResponse)
def update_ticket_status(
    ticket_id: int,
    status: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Only assigned technician or admin can update
    if current_user.id != ticket.technician_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to update this ticket")

    ticket.status = status
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



@app.get("/")
def read_root():
    return {"message": "Welcome to the Machine Learning-Based IT Ticketing System API"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
