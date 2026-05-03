from sqlalchemy.orm import Session
from fastapi import UploadFile

from app.services import minio_client, postgres_client
from app.workers.ingestion_tasks import ingest_document_task
from app.core.config import settings


class DocumentService:
    def __init__(self, db: Session):
        self.db = db
        
    async def handle_upload(self, file: UploadFile, admin_id: int,document_id: str, object_name: str):
        # 1. Lưu file vào MinIO
        file_url = await minio_client.upload(
            file=file,
            object_name=object_name,
            content_type=file.content_type,
        )
        
        #2. Lưu metadata vào Postgres
        new_doc = postgres_client.create_document(document_id=document_id,
            filename=file.filename,
            content_type=file.content_type,
            minio_bucket=settings.MINIO_BUCKET,
            minio_object_name=object_name,
            status="queued"
        )
        self.db.add(new_doc)
        self.db.commit()
        
        # 3. Gửi task cho Celery để xử lý nạp dữ liệu (OCR, Chunking, Embedding)
        # process_document_task.delay(new_doc.id)
        
        return {"id": "200", "status": "queued"}  
    
    def get_list_documents(self, file: UploadFile):
        return postgres_client.list_documents(self.db,file)  