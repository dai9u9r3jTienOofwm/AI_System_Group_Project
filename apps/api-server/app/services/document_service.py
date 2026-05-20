from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.services import minio_service, postgres_client
from app.core.config import settings
from app.workers.ingestion_tasks import process_document_task
import socket

class DocumentService:
    def __init__(self, db: Session, client: minio_service.MinioService):
        self.db = db
        self.client = client
    async def handle_upload(self, file: UploadFile, admin_id: int,document_id: str, object_name: str):
        # 1. Lưu file vào MinIO
        await self.client.upload_file(
            object_name=object_name,
            upload_file=file
        )
        print(f"Check document service: {type(self.db)}")
        #2. Lưu metadata vào Postgres
        # Get file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to start
        
        new_doc = postgres_client.create_document(db = self.db,
            document_id=document_id,
            filename=file.filename,
            content_type=file.content_type,
            file_size = file_size,
            minio_bucket=settings.MINIO_BUCKET,
            minio_object_name=object_name,
            status="queued",
            chunk_count = 0,
            error_message = None,
            upload_id=admin_id 
        )
        # 3. Gửi task cho Celery để xử lý nạp dữ liệu (OCR, Chunking, Embedding)
        process_document_task.delay(new_doc.document_id)
        
        return {"document_id": document_id,"filename": file.filename,"file_size": file.size, "status": "queued", "message":"Uploaded completed"}  
    
    def get_list_documents(self):
        return postgres_client.get_list_documents(self.db)
    
    def get_document(self, document_id: str):
        return postgres_client.get_document(db=self.db, document_id=document_id)
    
    