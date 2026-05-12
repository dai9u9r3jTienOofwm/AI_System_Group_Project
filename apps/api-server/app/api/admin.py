# - Nhận file từ FastAPI
# - Validate file
# - Gọi MinIO để upload file gốc
# - Tạo metadata trong PostgreSQL
# - Gửi task cho worker

from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.services.document_service import DocumentService
from app.services.minio_service import get_client
from app.db.session import get_db
from app.schemas.document import UploadDocumentRespond
from minio import Minio 

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
        # Thêm admin_id sau
        return await doc_service.handle_upload(file=file,admin_id=1,document_id=document_id,object_name=object_name) 
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(exc)}",
        )     