# Data validation and API response models
# Defines what data the API accepts and returns using Pydantic

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# Required data when registering a user
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = "user"  # allow creating admins/techs manually


# Data returned to frontend for any user
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


# Shared fields for tickets
class TicketBase(BaseModel):
    title: str
    description: str
    category: Optional[str] = "Uncategorized"
    status: Optional[str] = "Open"


# Data needed to submit a ticket
class TicketCreate(TicketBase):
    pass


# What API returns when sending ticket data
class TicketResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str
    status: str
    user_id: int
    technician_id: Optional[int] = None
    user_email: Optional[str] = None
    technician_email: Optional[str] = None

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    content: str
    sender_id: int
    sender_email: str
    created_at: str

    class Config:
        from_attributes = True


# ---------------------------
# Notifications
# ---------------------------
class NotificationResponse(BaseModel):
    id: int
    type: str
    ticket_id: Optional[int] = None
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
