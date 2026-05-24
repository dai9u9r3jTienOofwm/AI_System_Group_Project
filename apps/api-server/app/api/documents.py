# - Lấy danh sách tài liệu đã upload
# - Xem metadata của một tài liệu
# - Trả link xem/tải file từ MinIO
# - Có thể trả presigned URL hoặc stream file qua FastAPI
# - Reindex một tài liệu

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Cookie
from sqlalchemy.orm import Session
from app.services.document_service import DocumentService
from app.db.session import get_db
from app.schemas.document import DocumentRespond, DocumentListRespond
from app.services.minio_service import get_client
from app.services.ingestion_service import reindex_document
from app.services import postgres_client
from app.services import qdrant_service
from app.models.document import Document
from app.models.user import User
from sqlalchemy import distinct
router = APIRouter()


@router.get("/topics")
def get_available_topics(db: Session = Depends(get_db)):
    """Get list of unique topics that have documents."""
    documents = db.query(distinct(Document.topic)).filter(Document.topic.isnot(None)).all()
    topics = [topic[0] for topic in documents if topic[0]]
    return {"topics": sorted(topics)}


@router.get("",response_model=DocumentListRespond)
def list_documents(db: Session = Depends(get_db), user_id: str = None, topic: str = None):
    """List documents - chỉ trả lại documents mà user upload.
    
    Người dùng chỉ nhìn thấy:
    - Documents mà họ upload (uploaded_by == user_id)
    """
    doc_service = DocumentService(db, get_client())
    documents = doc_service.get_list_documents()
    
    # Filter dựa trên user_id - chỉ trả lại documents mà user sở hữu
    filtered_docs = []
    for doc in documents:
        # Chỉ trả lại documents của chính user đó upload (uploaded_by == user_id)
        if user_id and str(doc.uploaded_by) != str(user_id):
            continue
        
        # Filter dựa trên topic nếu được cung cấp
        if topic and doc.topic != topic:
            continue
            
        filtered_docs.append(doc)
    
    return {"document_list": filtered_docs}

#GET  /v1/documents/{document_id}
@router.get("/{document_id}",response_model=DocumentRespond)
async def get_document(document_id: str, db: Session = Depends(get_db), user_id: Optional[str] = Cookie(default=None)):
    """Get document - check quyền trước khi return."""
    doc_service = DocumentService(db, get_client())
    document_found = doc_service.get_document(document_id)
    
    if document_found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found!",
        )
    
    # 🔒 Kiểm tra quyền truy cập - chỉ owner mới xem được
    uploaded_by = document_found.uploaded_by
    
    # Chỉ cho phép nếu: User là owner (uploaded_by == user_id)
    is_owner = str(uploaded_by) == str(user_id)
    
    if not user_id or not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập tài liệu này!",
        )
    
    return document_found
    
@router.delete("/{document_id}")
async def delete_document_endpoint(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Delete document - no permission check."""

    print("DELETE ENDPOINT HIT - NO AUTH CHECK:", document_id)

    doc_service = DocumentService(db, get_client())
    document_found = doc_service.get_document(document_id)

    if document_found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found!",
        )

    try:
        qdrant_service.delete_by_document_id(document_id)
    except Exception as exc:
        print("Qdrant delete failed:", exc)

    postgres_client.delete_document(db, document_id)

    return {
        "status": "success",
        "detail": f"Document {document_id} deleted",
    }

#POST /v1/documents/{document_id}/reindex
@router.post("/{document_id}/reindex")
async def reindex_document_endpoint(document_id: str, db: Session = Depends(get_db), user_id: str = None):
    """Reindex a document - check quyền trước khi reindex."""
    doc_service = DocumentService(db, get_client())
    document_found = doc_service.get_document(document_id)
    
    if document_found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {document_id} not found!",
        )
    
    # 🔒 Kiểm tra quyền - chỉ owner mới reindex được
    uploaded_by = document_found.uploaded_by
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chưa đăng nhập",
        )
    
    # Check xem current user có phải admin không
    user = db.query(User).filter(User.id == int(user_id)).first()
    is_admin = user and user.role == 'admin'
    
    # Cho phép nếu: Admin hoặc owner (uploaded_by == user_id)
    is_owner = str(uploaded_by) == str(user_id)
    
    if not (is_admin or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền reindex tài liệu này!",
        )
    
    try:
        result = reindex_document(document_id)
        if result.get("status") == "failed":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Reindex failed"),
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reindex failed: {str(exc)}",
        )

