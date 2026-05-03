# - Nhận file từ FastAPI
# - Validate file
# - Gọi MinIO để upload file gốc
# - Tạo metadata trong PostgreSQL
# - Gửi task cho worker

from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.services.document_service import DocumentService
from app.db.session import get_db
 

router = APIRouter(perfix = "/v1/admin")

ALLOWED_EXTENSIONS = {
    ".pdf", ".md", ".txt",
    ".py", ".c", ".cpp", ".h", ".asm",
    ".yml", ".yaml", ".json",
}

def get_doc_service(db: Session = Depends(get_db)):
    return DocumentService(db)

@router.post("/upload")
async def upload_file(file: UploadFile = File(...),doc_service: DocumentService = Depends(get_doc_service)):
    if not file.filename:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= "Filename is required.",  
        )
    
    
    file_extension = '.'.join(file.filename.split('.')[-1].lower()) 

    
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= ".",  
        )   
    document_id = str(uuid4())
    object_name = f"documents/{document_id}/{file.filename}"
        
    try:
        #Gọi MinIO để upload file gốc
        doc_service_obj = get_doc_service(doc_service)
        # Thêm admin_id sau
        doc_service_obj.handle_upload(file, object_name, document_id, admin_id=1) 
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(exc)}",
        )     