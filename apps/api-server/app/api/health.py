from fastapi import APIRouter, HTTPException, status
from sqlalchemy import inspect, text
from app.db.session import engine

router = APIRouter()

@router.get("/health")
async def health_check():
    try:
        inspector = inspect(engine)
        
        if "user" not in inspector.get_table_names():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Tables not created yet"
            )
                
        return { "status": "ok"}
            
        
    except Exception as e:
        raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="DB offline"
            )