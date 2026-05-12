# - Định nghĩa task ingest_document(document_id)
# - Gọi ingestion_service để xử lý tài liệu
# - Bắt lỗi và cập nhật status failed nếu lỗi
import time
from celery import shared_task

#mock
@shared_task(name="process_document_task")
def process_document_task(document_id):
    time.sleep(5)
    return {
    "document_id": document_id,
    "filename": "mock",
    "status": "queued",
    "message": "File uploaded. Ingestion started in background."

    }
