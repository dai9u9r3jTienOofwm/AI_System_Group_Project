from sqlalchemy.orm import Session
from app.models.document import Document

from fastapi import UploadFile

#create_document()

def get_list_documents(self, file: UploadFile):
    pass

def get_document(db: Session, document_id: str):
    return db.query(Document).filter(Document.id == document_id).first()

