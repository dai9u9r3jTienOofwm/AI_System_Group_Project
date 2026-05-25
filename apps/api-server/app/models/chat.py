from datetime import datetime

from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base


class ChatSession(Base):
    
    __tablename__ = "chat_session"
    
    id = Column(String,primary_key= True, index= True)
    user_id = Column(Integer, ForeignKey("user.id", on_delete="CASCADE"),nullable=False)
    title = Column(String(255), nullable=False, default="Cuộc trò chuyện mới")
    topic = Column(String(100), nullable=False)
    
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    
    user = relationship("User", back_populates="chat_sessions")