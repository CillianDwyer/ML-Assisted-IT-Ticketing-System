# Data validation and API responce models
# Defines what data the API accepst and returns usimg pydantic

from pydantic import BaseModel, EmailStr
from typing import Optional

#Required data when registering a user
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = "user"  # allow creating admins/techs manually

#data returned to frontend for any user
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: str
    class Config:
        from_attributes = True

#shared field for tickets
class TicketBase(BaseModel):
    title: str
    description: str
    category: Optional[str] = "Uncategorized"
    status: Optional[str] = "Open"

#data needed to submit a ticket (just pass for now)
class TicketCreate(TicketBase):
    pass

#what API returns when sending ticket data
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
        orm_mode = True
