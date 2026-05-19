from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from app.models.document import Document

# Sentinel value to distinguish "not provided" from "explicitly set to None"
_UNSET = object()


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

def get_document(db: Session, document_id: str) -> Document | None:
    return db.query(Document).filter(Document.document_id == document_id).first()


def update_document_status(
    db: Session,
    document_id: str,
    status: str,
    chunk_count: int | None = None,
    error_message: str | None = _UNSET,
) -> Document | None:
    """Update a document's status and optional chunk_count / error_message.
    
    Pass ``error_message=None`` to explicitly clear a previous error message.
    Omit ``error_message`` (or pass the sentinel) to leave the current value unchanged.
    
    Returns the updated Document or None if not found."""
    doc = db.query(Document).filter(Document.document_id == document_id).first()
    if doc is None:
        return None
    doc.status = status
    if chunk_count is not None:
        doc.chunk_count = chunk_count
    if error_message is not _UNSET:
        doc.error_message = error_message
    doc.updated_at = datetime.now()
    db.commit()
    db.refresh(doc)
    return doc

