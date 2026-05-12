# - Khởi tạo Celery app
# - Cấu hình Redis broker
# - Cấu hình result backend
# - Tự động discover task


from celery import Celery
from app.core.config import settings

app = Celery("rag_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

app.conf.task_routes = {
"process_document_task": {"queue": "ingestion"}
}
app.autodiscover_tasks(['app.workers'], related_name='ingestion_tasks')