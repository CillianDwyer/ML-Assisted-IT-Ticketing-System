# modles.py
# Classes represent database tables

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")

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


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String)
    category = Column(String, default="Uncategorized")
    status = Column(String, default="Open")

    user_id = Column(Integer, ForeignKey("users.id"))
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)

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
