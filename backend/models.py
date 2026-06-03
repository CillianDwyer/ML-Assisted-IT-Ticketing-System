# models.py
# Classes represent database tables

from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")

    # technician speciality
    speciality = Column(String, nullable=True)

    # Distinguish between tickets created and assigned
    created_tickets = relationship(
        "Ticket",
        back_populates="owner",
        foreign_keys="Ticket.user_id"
    )
    assigned_tickets = relationship(
        "Ticket",
        back_populates="technician",
        foreign_keys="Ticket.technician_id"
    )

    # notifications for this user
    notifications = relationship(
        "Notification",
        back_populates="user"
    )


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    category = Column(String, default="Uncategorized")
    team = Column(String, default="Unassigned", nullable=False)
    status = Column(String, default="Open")
    priority = Column(String, default="Low", nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # timestamps (for analytics)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)

    # Clearly define relationships
    owner = relationship(
        "User",
        back_populates="created_tickets",
        foreign_keys=[user_id]
    )
    technician = relationship(
        "User",
        back_populates="assigned_tickets",
        foreign_keys=[technician_id]
    )

    notifications = relationship(
        "Notification",
        back_populates="ticket"
    )


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True)
    content = Column(String, nullable=False)
    created_at = Column(String)
    is_private = Column(Boolean, default=False, nullable=False)
    attachment_name = Column(String, nullable=True)
    attachment_path = Column(String, nullable=True)
    attachment_type = Column(String, nullable=True)
    attachment_size = Column(Integer, nullable=True)

    ticket_id = Column(Integer, ForeignKey("tickets.id"), index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    ticket = relationship("Ticket")
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    # "message", "assignment", "status"
    type = Column(String, nullable=False)

    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True, index=True)

    content = Column(String, nullable=False)

    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="notifications")
    ticket = relationship("Ticket", back_populates="notifications")
