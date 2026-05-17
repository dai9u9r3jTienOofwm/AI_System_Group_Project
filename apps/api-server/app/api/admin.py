# - Nhận file từ FastAPI
# - Validate file
# - Gọi MinIO để upload file gốc
# - Tạo metadata trong PostgreSQL
# - Gửi task cho worker

from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status, Cookie
from sqlalchemy.orm import Session
from app.services.document_service import DocumentService
from app.services.minio_service import get_client
from app.db.session import get_db
from app.schemas.document import UploadDocumentRespond
from minio import Minio 
from app.models.user import User

router = APIRouter()

ALLOWED_EXTENSIONS = {
    ".pdf", ".md", ".txt",
    ".py", ".c", ".cpp", ".h", ".asm",
    ".yml", ".yaml", ".json",
}

def get_doc_service(db: Session = Depends(get_db)):
    return DocumentService(db, get_client())

@router.post("/upload", response_model=UploadDocumentRespond)
async def upload_file(file: UploadFile = File(...),doc_service: DocumentService = Depends(get_doc_service),userId: str = Cookie(None)):
    if not userId:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!"
        )
    if not file.filename:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= "Filename is required.",  
        )
    
    
    file_extension = '.'+ str(file.filename.split('.')[-1].lower()) 

    
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= ".",  
        )   
    document_id = str(uuid4())
    object_name = f"documents/{document_id}/{file.filename}"
        
    try:
        user_id = int(userId)
        return await doc_service.handle_upload(file=file,admin_id=user_id,document_id=document_id,object_name=object_name) 
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(exc)}",
        )     
        
@router.get("/user")
def get_all_users(db:Session = Depends(get_db)):
    users = db.query(User).all()
    return users  



@router.delete("/user/{user_id}")      
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "success","detail": "User deleted successfully"}