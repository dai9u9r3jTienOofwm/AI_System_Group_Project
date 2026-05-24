from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional



class UserRespond(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    
    created_at: datetime
    
    
    class Config:
        from_attributes = True