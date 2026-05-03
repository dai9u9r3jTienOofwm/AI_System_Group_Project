# - Lấy danh sách tài liệu đã upload
# - Xem metadata của một tài liệu
# - Trả link xem/tải file từ MinIO
# - Có thể trả presigned URL hoặc stream file qua FastAPI


from fastapi import APIRouter, Depends, Session
from app.services.document_service import DocumentService
from app.db.session import get_db

router = APIRouter(prefix= "v1/documents")


@router.get("")
def list_documents(db: Session = Depends(get_db)):
    doc_service =  DocumentService(db)
    return doc_service.get_list_documents()

#GET  /v1/documents/{document_id}
@router.get("/{document_id}")
async def get_document(document_id: str):
    #code here
    return {"document_id": document_id, "status": "found"}
    
    
#POST /v1/documents/{document_id}/reindex    
    