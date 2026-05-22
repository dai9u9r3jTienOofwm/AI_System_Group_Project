# - Lấy danh sách tài liệu đã upload
# - Xem metadata của một tài liệu
# - Trả link xem/tải file từ MinIO
# - Có thể trả presigned URL hoặc stream file qua FastAPI
# - Reindex một tài liệu


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.services.document_service import DocumentService
from app.db.session import get_db
from app.schemas.document import DocumentRespond, DocumentListRespond
from app.services.minio_service import get_client
from app.services.ingestion_service import reindex_document
from app.services import postgres_client
from app.services import qdrant_service
from app.models.document import Document
from sqlalchemy import distinct
router = APIRouter()


@router.get("/topics")
def get_available_topics(db: Session = Depends(get_db)):
    """Get list of unique topics that have documents."""
    documents = db.query(distinct(Document.topic)).filter(Document.topic.isnot(None)).all()
    topics = [topic[0] for topic in documents if topic[0]]
    return {"topics": sorted(topics)}


@router.get("",response_model=DocumentListRespond)
def list_documents(db: Session = Depends(get_db)):
    doc_service =  DocumentService(db,get_client())
    return {"document_list": doc_service.get_list_documents()}

#GET  /v1/documents/{document_id}
@router.get("/{document_id}",response_model=DocumentRespond)
async def get_document(document_id: str,db: Session = Depends(get_db)):
    doc_service =  DocumentService(db,get_client())
    
    document_found = doc_service.get_document(document_id)
    
    if document_found is None:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= f"Document {document_id} not found!",
        )
    
    return document_found
    
#DELETE /v1/documents/{document_id}
@router.delete("/{document_id}")
async def delete_document_endpoint(document_id: str, db: Session = Depends(get_db)):
    doc_service = DocumentService(db, get_client())
    document_found = doc_service.get_document(document_id)
    if document_found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found!",
        )
    try:
        qdrant_service.delete_by_document_id(document_id)
    except Exception:
        pass
    postgres_client.delete_document(db, document_id)
    return {"status": "success", "detail": f"Document {document_id} deleted"}


#POST /v1/documents/{document_id}/reindex
@router.post("/{document_id}/reindex")
async def reindex_document_endpoint(document_id: str, db: Session = Depends(get_db)):
    """Reindex a document: clean old chunks and re-run ingestion pipeline."""
    doc_service = DocumentService(db, get_client())
    document_found = doc_service.get_document(document_id)
    
    if document_found is None:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= f"Document {document_id} not found!",
        )
    
    try:
        result = reindex_document(document_id)
        if result.get("status") == "failed":
            raise HTTPException(
                status_code= status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail= result.get("error", "Reindex failed"),
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code= status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail= f"Reindex failed: {str(exc)}",
        )

