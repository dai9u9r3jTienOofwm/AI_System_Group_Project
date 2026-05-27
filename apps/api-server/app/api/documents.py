# - Lấy danh sách tài liệu đã upload
# - Xem metadata của một tài liệu
# - Trả link xem/tải file từ MinIO
# - Có thể trả presigned URL hoặc stream file qua FastAPI
# - Reindex một tài liệu
# - Fetch file content (Stage 10 Citation - minh chứng)

from typing import Optional
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Cookie
from fastapi.responses import StreamingResponse
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
from app.core.config import settings
from sqlalchemy import distinct

logger = logging.getLogger(__name__)
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


# ═══════════════════════════════════════════════════════════════════════════
# Stage 10 Citation Feature: Fetch file content from MinIO
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    db: Session = Depends(get_db),
    user_id: Optional[str] = Cookie(default=None)
):
    """
    Fetch actual file content from MinIO for citation verification.
    
    Used in Stage 10: Frontend displays file content as evidence for sources cited in AI answer.
    
    Args:
        document_id: UUID of the document
        user_id: Current user (from cookie)
    
    Returns:
        StreamingResponse: File content with appropriate media type
    
    Permission:
        - User can only access their own documents
        - Admin can access any document
    """
    doc_service = DocumentService(db, get_client())
    document_found = doc_service.get_document(document_id)
    
    if not document_found:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # 🔒 Permission check
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if admin or owner
    user = db.query(User).filter(User.id == int(user_id)).first()
    is_admin = user and user.role == "admin"
    is_owner = str(document_found.uploaded_by) == str(user_id)
    
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Fetch file from MinIO
    try:
        minio_service = get_client()
        file_content = minio_service.download_file(
            bucket_name=document_found.minio_bucket,
            object_name=document_found.minio_object_name
        )
        
        logger.info(
            "Fetching document content: document_id=%s filename=%s size=%d",
            document_id,
            document_found.filename,
            len(file_content)
        )
        
        # Return as streaming response
        from io import BytesIO
        return StreamingResponse(
            iter([file_content]),
            media_type=document_found.content_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"inline; filename=\"{document_found.filename}\"",
                "Content-Length": str(len(file_content))
            }
        )
    except Exception as exc:
        logger.error("Failed to fetch file from MinIO: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch file content")


@router.get("/{document_id}/chunk-preview")
async def get_chunk_preview(
    document_id: str,
    chunk_index: int = 0,
    db: Session = Depends(get_db),
    user_id: Optional[str] = Cookie(default=None)
):
    """
    Fetch specific chunk content from Qdrant for citation preview.
    
    Used in Stage 10: Frontend displays chunk excerpt when hovering over or clicking sources.
    
    Args:
        document_id: UUID of the document
        chunk_index: 0-based chunk index
        user_id: Current user (from cookie)
    
    Returns:
        JSON with chunk content and metadata
    
    Permission:
        - User can only access their own documents
        - Admin can access any document
    """
    doc_service = DocumentService(db, get_client())
    document_found = doc_service.get_document(document_id)
    
    if not document_found:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # 🔒 Permission check
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    is_admin = user and user.role == "admin"
    is_owner = str(document_found.uploaded_by) == str(user_id)
    
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get specific chunk from Qdrant
    try:
        from qdrant_client.http.models import Filter, FieldCondition, MatchValue
        qdrant_client = qdrant_service.get_client()
        
        # Search for this specific document + chunk_index
        results = qdrant_client.search(
            collection_name=settings.QDRANT_COLLECTION,
            query_vector=[0.0] * settings.QDRANT_VECTOR_SIZE,  # Dummy vector
            query_filter=Filter(must=[
                FieldCondition(
                    key="metadata.document_id",
                    match=MatchValue(value=document_id)
                ),
                FieldCondition(
                    key="metadata.chunk_index",
                    match=MatchValue(value=chunk_index)
                )
            ]),
            limit=1,
            with_payload=True,
            with_vectors=False
        )
        
        if not results:
            raise HTTPException(status_code=404, detail="Chunk not found")
        
        payload = results[0].payload
        chunk_text = payload.get("text", "")
        metadata = payload.get("metadata", {})
        
        logger.info(
            "Fetching chunk preview: document_id=%s chunk_index=%d",
            document_id,
            chunk_index
        )
        
        return {
            "document_id": document_id,
            "filename": document_found.filename,
            "chunk_index": chunk_index,
            "content": chunk_text[:500],  # First 500 chars
            "full_content": chunk_text,
            "metadata": metadata
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to fetch chunk from Qdrant: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch chunk preview")

