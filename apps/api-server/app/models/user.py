from sqlalchemy import Column, String, Integer, Boolean
from app.db.base import Base


class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String, nullable=False)
    is_active = Column(Boolean(), default=True) 
    role = Column(String, default="user")
    
