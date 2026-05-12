from sqlalchemy.orm import Session
from app.models.document import Document
from app.db.session import get_db
from typing import List

def create_document(db: Session,
            document_id: str,
            filename: str,
            content_type: str,
            file_size: int,
            minio_bucket: str,
            minio_object_name: str,
            status: str,
            upload_id: int):
    print(f"Check postgrest: {type(db)}")
    new_doc =  Document(document_id = document_id,
                filename = filename,
                file_size = file_size,
                minio_bucket = minio_bucket,
                minio_object_name = minio_object_name,
                status = status,
                uploaded_by = upload_id)
    
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc
def get_list_documents(db: Session) -> List:
    return db.query(Document).all()

def get_document(db: Session, document_id: str) -> Document:
    return db.query(Document).filter(Document.document_id == document_id).first()

