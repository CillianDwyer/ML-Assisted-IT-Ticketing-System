# routers/tickets.py
# Ticket views, creation, assignment and updates.

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session, joinedload

import auth
import models
import schemas
from constants import ALLOWED_STATUSES, STATUS_CLOSED, STATUS_OPEN
from database import get_db
from ml.ml_model import predict_category
from notify import (
    create_notification,
    notify_admins_about_unassigned_ticket,
    notify_ticket_participants,
)
from ticket_logic import (
    can_access_ticket,
    compute_ticket_priority,
    pick_technician_for_team,
    prepare_tickets_for_response,
    resolve_ticket_team,
    set_ticket_sla_state,
)
from timeutils import utcnow

router = APIRouter(tags=["tickets"])


def _ticket_query(db: Session):
    return db.query(models.Ticket).options(
        joinedload(models.Ticket.owner),
        joinedload(models.Ticket.technician),
    )


@router.get("/tickets/all", response_model=list[schemas.TicketResponse])
def get_all_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view all tickets")

    tickets = _ticket_query(db).offset(offset).limit(limit).all()
    return prepare_tickets_for_response(db, tickets)


@router.get("/tickets", response_model=list[schemas.TicketResponse])
def get_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
):
    tickets = (
        _ticket_query(db)
        .filter(models.Ticket.user_id == current_user.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return prepare_tickets_for_response(db, tickets)


@router.get("/tickets/assigned", response_model=list[schemas.TicketResponse])
def get_assigned_tickets(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
):
    if current_user.role != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can view assigned tickets")

    tickets = (
        _ticket_query(db)
        .filter(models.Ticket.technician_id == current_user.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return prepare_tickets_for_response(db, tickets)


@router.get("/tickets/{ticket_id}", response_model=schemas.TicketResponse)
def get_ticket_by_id(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    ticket = _ticket_query(db).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if not can_access_ticket(ticket, current_user, db):
        raise HTTPException(status_code=403, detail="Not authorized")

    return prepare_tickets_for_response(db, [ticket])[0]


@router.post("/tickets", response_model=schemas.TicketResponse)
def create_ticket(
    ticket: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Main workflow: classify, route, prioritise, assign, save, then notify.
    predicted_category = predict_category(ticket.description)
    predicted_team = resolve_ticket_team(predicted_category)
    now = utcnow()

    technician = pick_technician_for_team(db, predicted_team)

    db_ticket = models.Ticket(
        title=ticket.title,
        description=ticket.description,
        category=predicted_category,
        team=predicted_team or "Unassigned",
        status=STATUS_OPEN,
        priority=compute_ticket_priority(
            status=STATUS_OPEN,
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
    else:
        notify_admins_about_unassigned_ticket(db, db_ticket)
    db.commit()

    set_ticket_sla_state(db_ticket)
    return db_ticket


@router.put("/tickets/{ticket_id}/assign/{technician_id}", response_model=schemas.TicketResponse)
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
    ticket.updated_at = utcnow()
    ticket.priority = compute_ticket_priority(
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at
    )

    if not ticket.status:
        ticket.status = STATUS_OPEN

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


@router.put("/tickets/{ticket_id}/status", response_model=schemas.TicketResponse)
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

    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    ticket.status = status
    ticket.updated_at = utcnow()
    ticket.closed_at = utcnow() if status == STATUS_CLOSED else None
    ticket.priority = compute_ticket_priority(
        status=ticket.status,
        category=ticket.category,
        created_at=ticket.created_at
    )

    db.commit()
    db.refresh(ticket)

    if notify_ticket_participants(
        db,
        ticket,
        actor_id=current_user.id,
        type="status",
        content=f"Ticket #{ticket.id} status updated to '{ticket.status}'"
    ):
        db.commit()

    set_ticket_sla_state(ticket)
    return ticket


@router.put("/tickets/{ticket_id}/category", response_model=schemas.TicketResponse)
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
    technician = pick_technician_for_team(db, mapped_team)

    previous_technician_id = ticket.technician_id

    ticket.category = category
    ticket.team = mapped_team or "Unassigned"
    ticket.technician_id = technician.id if technician else None
    ticket.updated_at = utcnow()

    if not ticket.status:
        ticket.status = STATUS_OPEN
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


@router.get("/users", response_model=list[schemas.UserResponse])
def get_all_users(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view users")
    return db.query(models.User).all()


@router.get("/tickets/{ticket_id}/assist-users", response_model=list[schemas.UserResponse])
def get_assist_users(
    ticket_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if not can_access_ticket(ticket, current_user, db):
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
