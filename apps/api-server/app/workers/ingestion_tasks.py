"""
Celery tasks for document ingestion.

Exposes ``process_document_task`` which is called by the upload flow in
``document_service.py``.  It delegates the actual work to
``ingestion_service.ingest_document()``.
"""

import logging

from celery import shared_task

from app.services.ingestion_service import ingest_document

logger = logging.getLogger(__name__)


@shared_task(name="process_document_task", bind=True, max_retries=3, default_retry_delay=10)
def process_document_task(self, document_id: str) -> dict:
    """
    Celery task that triggers the full ingestion pipeline for *document_id*.

    Delegates to ``ingestion_service.ingest_document()`` and logs the outcome.
    Retries up to 3 times on transient errors.
    """
    logger.info("Celery task received for document_id=%s", document_id)

    try:
        result = ingest_document(document_id)

        if result.get("status") == "failed":
            logger.error(
                "Ingestion failed for document_id=%s: %s",
                document_id, result.get("error"),
            )

        return result

    except Exception as exc:
        logger.exception(
            "Unexpected error in process_document_task for document_id=%s",
            document_id,
        )
        try:
            self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(
                "Max retries exceeded for document_id=%s", document_id,
            )
            return {
                "document_id": document_id,
                "status": "failed",
                "error": str(exc),
                "message": "Max retries exceeded.",
            }
