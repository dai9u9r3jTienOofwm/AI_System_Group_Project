"""
Ingest status endpoint — provides an overview of ingestion pipeline state.

Returns an aggregate summary (status / progress / message) plus the full
document list with frontend-friendly field names.

GET /v1/ingest/status
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import postgres_client

logger = logging.getLogger(__name__)

router = APIRouter()

# Default progress estimates per status (actual progress tracking TBD)
_STATUS_PROGRESS: dict[str, int] = {
    "uploaded":   0,
    "queued":     5,
    "processing": 50,
    "completed":  100,
    "indexed":    100,
    "failed":     100,
}


def _overall_status(docs: list) -> str:
    """Derive an aggregate status from all documents."""
    if not docs:
        return "idle"
    # If any document is processing → overall processing
    if any(d.status == "processing" for d in docs):
        return "processing"
    # If any document is queued → overall queued → show as processing
    if any(d.status == "queued" for d in docs):
        return "processing"
    # If all completed/indexed → overall completed
    all_terminal = all(d.status in ("completed", "indexed") for d in docs)
    if all_terminal:
        return "completed"
    # mix of failed + completed → partial failure
    return "failed"


def _overall_progress(docs: list) -> int:
    """Average progress across all documents."""
    if not docs:
        return 0
    total = sum(_STATUS_PROGRESS.get(d.status, 0) for d in docs)
    return total // len(docs)


def _doc_to_frontend(doc) -> dict:
    """Map a Document ORM row to the frontend-friendly shape."""
    return {
        "id": doc.document_id,
        "name": doc.filename,
        "size": doc.file_size,
        "status": doc.status,
        "topic": doc.topic,
        "uploadedAt": (
            doc.created_at.isoformat() + "Z" if isinstance(doc.created_at, datetime)
            else str(doc.created_at)
        ),
        "error_message": doc.error_message,
        "chunk_count": doc.chunk_count,
    }


@router.get("/status")
def get_ingest_status(db: Session = Depends(get_db)):
    """Return aggregate ingest status plus full document list."""
    docs = postgres_client.get_list_documents(db)
    return {
        "status": _overall_status(docs),
        "progress": _overall_progress(docs),
        "documents": [_doc_to_frontend(d) for d in docs],
        "message": f"{len(docs)} document(s) tracked",
    }
