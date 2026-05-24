from fastapi import APIRouter, Depends, HTTPException, status, Cookie
from sqlalchemy.orm import Session
from typing import List
from uuid import uuid4
from app.db.session import get_db
from app.schemas.chat import ChatSessionResponse, ChatSessionCreate
from app.models.chat import ChatSession


router = APIRouter()


@router.post("")
def create_new_chat(payload: ChatSessionCreate,db: Session = Depends(get_db), userId: str = Cookie(None)):
    if not userId:
        raise HTTPException(status_code= status.HTTP_401_UNAUTHORIZED, detail= "Chưa đăng nhập")
    
    try:
        new_session = ChatSession(
            id=str(uuid4()),
            user_id=int(userId),
            topic=payload.topic,
            title=payload.title
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session
    except ValueError:
        raise HTTPException(status_code= status.HTTP_400_BAD_REQUEST , detail="ID người dùng không hợp lệ")
@router.get("", response_model=List[ChatSessionResponse])
def get_user_chat_sessions(
    db: Session = Depends(get_db),
    userId: str = Cookie(None)
):
    if not userId:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="User chưa đăng nhập"
        )
    
    sessions = db.query(ChatSession)\
        .filter(ChatSession.user_id == int(userId))\
        .order_by(ChatSession.created_at.desc())\
        .all()
        
    return sessions