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
async def upload_file(file: UploadFile = File(...),doc_service: DocumentService = Depends(get_doc_service)):
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
        return await doc_service.handle_upload(file=file,upload_by = "admin",document_id=document_id,object_name=object_name) 
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(exc)}",
        )     
        
@router.get("/user")
def get_all_users(db:Session = Depends(get_db)):
    users = db.query(User).all()
    return users  

@router.post("/users")
@router.post("/user")
def create_user(userdata,db:Session = Depends(get_db)):
    exist_user = db.query(User).filter(User.email == userdata.get("email")).first() 
    
    if exist_user:
        raise HTTPException(status_code=400, detail=f"Email {userdata.get('email')}!")

    new_user = User(
        username = userdata.get("username"),
        email = userdata.get("email"),
        password = userdata.get("password"),
        is_active = True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"status": "success", "message": "User created!"}

@router.put("/users/{user_id}")
def update_user(user_id, user_data,db:Session = Depends(get_db) ):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found!")
        
    # Cập nhật các trường thông tin do Admin truyền lên
    if "role" in user_data:
        user.role = user_data["role"]      # Đổi quyền (ví dụ: cấp quyền admin hoặc hạ quyền xuống user)
    if "username" in user_data:
        user.username = user_data["username"]
        
    db.commit()
    return {"status": "success", "message": "Updated user!"}

@router.delete("/users/{user_id}")
@router.delete("/user/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "success","detail": "User deleted successfully"}