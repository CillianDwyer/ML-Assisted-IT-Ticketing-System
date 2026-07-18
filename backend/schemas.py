# Data validation and API response models
# Defines what data the API accepts and returns using Pydantic

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = "user"


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


class TicketBase(BaseModel):
    title: str
    description: str
    category: Optional[str] = "Uncategorized"
    status: Optional[str] = "Open"


class TicketCreate(TicketBase):
    pass


class TicketResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str
    team: str
    status: str
    priority: str
    sla_state: str
    user_id: int
    technician_id: Optional[int] = None
    user_email: Optional[str] = None
    technician_email: Optional[str] = None

    # timestamps
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: Optional[str] = None
    private_to_email: Optional[EmailStr] = None


class MessageResponse(BaseModel):
    id: int
    content: str
    sender_id: int
    sender_email: str
    created_at: datetime
    is_private: bool
    recipient_email: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_size: Optional[int] = None

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    type: str
    ticket_id: Optional[int] = None
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
