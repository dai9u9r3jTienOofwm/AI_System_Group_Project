"""
Ingestion pipeline service (Stage 7 — real parse & chunk).

Orchestrates the full ingestion lifecycle for a single document:
  queue → processing → completed | failed

Responsibilities:
- Load document metadata from PostgreSQL
- Download the original file from MinIO
- Detect file type by extension
- Parse file into LangChain Documents using real loaders (PyPDFLoader, etc.)
- Split Documents into chunks via LangChain splitters (RecursiveCharacterTextSplitter,
  MarkdownHeaderTextSplitter, language-aware code splitters)
- Apply rich metadata to every chunk (document_id, filename, page, section_title, language)
- Persist chunk data through a placeholder hook (Stage 8 will provide Qdrant)
- Update document status and chunk_count at every milestone
- Clean up old chunks on reindex via a placeholder hook
"""

import logging
import os
import tempfile
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.document import Document
from app.services.minio_service import MinioService, get_client
from app.services import postgres_client

# ── LangChain imports (Stage 7) ──────────────────────────────────────────
from langchain_core.documents import Document as LCDocument
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
    Language,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants – may be promoted to settings later
# ---------------------------------------------------------------------------
DEFAULT_CHUNK_SIZE: int = 1000        # characters
DEFAULT_CHUNK_OVERLAP: int = 200      # characters

# Separator sequences for code-language-aware splitters.
# The RecursiveCharacterTextSplitter uses these in order; the first
# separator that fits within chunk_size wins.
_LANGUAGE_SPLITTER_MAP: dict[str, Language] = {
    "python":     Language.PYTHON,
    "javascript": Language.JS,
    "typescript": Language.TS,
    "c":          Language.C,
    "cpp":        Language.CPP,
    "java":       Language.JAVA,
}

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def ingest_document(document_id: str) -> dict[str, Any]:
    """
    Full ingestion pipeline for a single document.

    1. Load document metadata from PostgreSQL.
    2. Transition status to ``processing``.
    3. Download raw file from MinIO.
    4. Detect file type.
    5. Parse file into LangChain ``Document`` objects (one per page for PDF).
    6. Split into chunks using LangChain splitters with rich metadata.
    7. Persist chunks (placeholder hook for Stage 8).
    8. Mark document as ``completed`` with ``chunk_count``.

    On any failure the document status is set to ``failed`` and the
    exception message is persisted in ``error_message``.

    Returns a result dictionary.
    """
    db: Session = SessionLocal()
    minio_service: MinioService = get_client()

    try:
        # ── 1. Load metadata ──────────────────────────────────────────
        doc = postgres_client.get_document(db, document_id)
        if doc is None:
            raise ValueError(f"Document {document_id} not found in database.")

        logger.info("Ingesting document_id=%s filename=%s", document_id, doc.filename)

        # ── 1b. Idempotency guard: skip if already completed ──────────
        if doc.status == "completed":
            logger.info(
                "Document %s already completed with %d chunks – skipping.",
                document_id, doc.chunk_count or 0,
            )
            return {
                "document_id": document_id,
                "filename": doc.filename,
                "status": "completed",
                "chunk_count": doc.chunk_count or 0,
                "message": "Already ingested.",
            }

        # ── 2. Status → processing ────────────────────────────────────
        postgres_client.update_document_status(db, document_id, status="processing")

        # ── 3. Download from MinIO ────────────────────────────────────
        raw_bytes: bytes = minio_service.download_file(
            bucket_name=doc.minio_bucket,
            object_name=doc.minio_object_name,
        )
        logger.info(
            "Downloaded %d bytes from MinIO (%s/%s)",
            len(raw_bytes), doc.minio_bucket, doc.minio_object_name,
        )

        # ── 4. Detect file type ───────────────────────────────────────
        file_ext = _get_extension(doc.filename)
        content_type = _detect_content_type(file_ext)
        logger.info("Detected file_type=%s extension=%s", content_type, file_ext)

        # ── 5. Parse content into LangChain Documents ─────────────────
        parsed_docs: list[LCDocument] = _parse_content(
            raw_bytes, content_type, doc.filename,
        )
        if not parsed_docs:
            raise ValueError(f"Parsed content is empty for document {document_id}.")

        # ── 6. Chunk Documents using LangChain splitters ──────────────
        chunked_docs: list[LCDocument] = _chunk_documents(
            docs=parsed_docs,
            content_type=content_type,
            chunk_size=DEFAULT_CHUNK_SIZE,
            chunk_overlap=DEFAULT_CHUNK_OVERLAP,
        )
        chunk_count = len(chunked_docs)
        logger.info("Split into %d chunks", chunk_count)

        # Attach document-level metadata to every chunk
        base_metadata = {
            "document_id": document_id,
            "filename": doc.filename,
            "minio_bucket": doc.minio_bucket,
            "minio_object_name": doc.minio_object_name,
            "source_type": content_type,
        }
        enriched_chunks: list[dict] = []
        for idx, lc_doc in enumerate(chunked_docs):
            merged = {**base_metadata, **lc_doc.metadata, "chunk_index": idx}
            # Ensure stable-ish id for dedup
            merged["chunk_id"] = f"{document_id}_chunk_{idx:06d}"
            enriched_chunks.append({
                "text": lc_doc.page_content,
                "metadata": merged,
            })

        # ── 7. Persist chunks (placeholder – Stage 8 replaces this) ──
        _persist_chunks(document_id, enriched_chunks)

        # ── 8. Status → completed (explicitly clear any error_message) ─
        postgres_client.update_document_status(
            db, document_id, status="completed", chunk_count=chunk_count,
            error_message=None,
        )

        logger.info(
            "Ingestion complete for document_id=%s (%d chunks)",
            document_id, chunk_count,
        )

        return {
            "document_id": document_id,
            "filename": doc.filename,
            "status": "completed",
            "chunk_count": chunk_count,
            "message": "Ingestion completed successfully.",
        }

    except Exception as exc:
        logger.exception("Ingestion failed for document_id=%s", document_id)
        try:
            postgres_client.update_document_status(
                db, document_id, status="failed", error_message=str(exc),
            )
        except Exception as db_err:
            logger.error("Failed to update error status in DB: %s", db_err)

        return {
            "document_id": document_id,
            "status": "failed",
            "error": str(exc),
            "message": "Ingestion failed.",
        }

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Reindex support
# ---------------------------------------------------------------------------

def reindex_document(document_id: str) -> dict[str, Any]:
    """
    Remove existing chunks for *document_id* (placeholder), then
    re-run the full ingestion pipeline.

    Resets the document status to ``queued`` before calling
    ``ingest_document()`` so that the idempotency guard (skip if
    already ``completed``) does not prevent reprocessing.
    """
    logger.info("Reindex requested for document_id=%s", document_id)

    db: Session = SessionLocal()
    try:
        # ── Reset status so the idempotency guard in ingest_document()
        #    does not skip re-ingestion for already-completed docs ─────
        postgres_client.update_document_status(db, document_id, status="queued")

        # ── Cleanup hook (Stage 8 will call qdrant_service) ───────────
        _cleanup_old_chunks(document_id)

        # Re-run the full ingestion pipeline
        return ingest_document(document_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_extension(filename: str) -> str:
    """Return the lowercase file extension including the dot, e.g. ``.pdf``."""
    _, ext = os.path.splitext(filename)
    return ext.lower()


def _detect_content_type(file_ext: str) -> str:
    """Map a file extension to a logical content-type label."""
    mapping = {
        ".pdf":  "pdf",
        ".md":   "markdown",
        ".txt":  "text",
        ".py":   "python",
        ".js":   "javascript",
        ".ts":   "typescript",
        ".c":    "c",
        ".cpp":  "cpp",
        ".h":    "c_header",
        ".java": "java",
        ".yaml": "yaml",
        ".yml":  "yaml",
        ".json": "json",
    }
    return mapping.get(file_ext, "text")


# ---------------------------------------------------------------------------
# Stage 7: Real parsing with LangChain loaders
# ---------------------------------------------------------------------------


def _parse_content(raw_bytes: bytes, content_type: str, filename: str) -> list[LCDocument]:
    """
    Parse ``raw_bytes`` into a list of LangChain ``Document`` objects.

    Each Document carries relevant source metadata:
    - PDF: one Document per page with ``{"page": N}``.
    - Other formats: a single Document.
    """
    # ── PDF via PyPDFLoader ──────────────────────────────────────────
    if content_type == "pdf":
        return _parse_pdf(raw_bytes)

    # ── All other formats: decode to text first ──────────────────────
    try:
        text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = raw_bytes.decode("latin-1")

    if not text.strip():
        return []

    # Attach language metadata for code-like content types
    lang_meta: dict[str, str] = {}
    code_types = {"python", "javascript", "typescript", "c", "cpp", "c_header", "java"}
    if content_type in code_types:
        lang_meta["language"] = content_type
    elif content_type == "markdown":
        lang_meta["language"] = "markdown"
    elif content_type in ("yaml", "json"):
        lang_meta["language"] = content_type

    return [LCDocument(page_content=text, metadata=lang_meta)]


def _parse_pdf(raw_bytes: bytes) -> list[LCDocument]:
    """
    Parse PDF bytes into page-level LangChain Documents using PyPDFLoader.

    Writes to a temporary file because PyPDFLoader requires a file path.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()
        # PyPDFLoader already sets ``page`` in metadata; ensure consistency
        for p in pages:
            p.metadata.pop("source", None)  # remove temp-file path
            p.metadata.setdefault("page", 0)
        return pages
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# Stage 7: Real chunking with LangChain text splitters
# ---------------------------------------------------------------------------


def _chunk_documents(
    docs: list[LCDocument],
    content_type: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[LCDocument]:
    """
    Split parsed LangChain ``Document`` objects into smaller chunks using
    LangChain splitters.

    Strategy per content type:
    - **markdown**: ``MarkdownHeaderTextSplitter`` first (preserves heading
      hierarchy as ``section_title`` metadata), then further split sections
      with ``RecursiveCharacterTextSplitter``.
    - **code** (python, javascript, typescript, c, cpp, java): language-aware
      ``RecursiveCharacterTextSplitter.from_language()``.
    - **pdf / text / yaml / json / other**: plain
      ``RecursiveCharacterTextSplitter`` (``split_documents`` preserves
      per-page metadata).
    """
    if not docs:
        return []

    if content_type == "markdown":
        return _chunk_markdown(docs, chunk_size, chunk_overlap)

    if content_type in _LANGUAGE_SPLITTER_MAP:
        splitter = RecursiveCharacterTextSplitter.from_language(
            language=_LANGUAGE_SPLITTER_MAP[content_type],
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
    else:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    return splitter.split_documents(docs)


def _chunk_markdown(
    docs: list[LCDocument],
    chunk_size: int,
    chunk_overlap: int,
) -> list[LCDocument]:
    """
    Split markdown content respecting header hierarchy.

    1. Combine all input documents into a single text.
    2. Run ``MarkdownHeaderTextSplitter`` to produce section-level Documents
       with ``section_title`` metadata.
    3. Further split each section with ``RecursiveCharacterTextSplitter``
       if it exceeds *chunk_size*.
    """
    combined_text = "\n\n".join(d.page_content for d in docs if d.page_content.strip())
    if not combined_text.strip():
        return []

    # ── Headers to track ─────────────────────────────────────────────
    headers_to_split_on = [
        ("#",     "h1"),
        ("##",    "h2"),
        ("###",   "h3"),
    ]

    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on,
        strip_headers=False,
    )

    # Produce section-level Documents
    section_docs: list[LCDocument] = header_splitter.split_text(combined_text)

    # ── Further split each section ───────────────────────────────────
    if not section_docs:
        # fallback: no headers found — treat as plain text
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        return splitter.split_documents(docs)

    # Consolidate header metadata: MarkdownHeaderTextSplitter stores
    # each header level as a separate metadata key. Combine into a
    # single ``section_title`` for convenience.
    for sec in section_docs:
        titles = []
        for h_key in ("h1", "h2", "h3"):
            val = sec.metadata.pop(h_key, None)
            if val:
                titles.append(str(val))
        if titles:
            sec.metadata["section_title"] = " > ".join(titles)
        sec.metadata["language"] = "markdown"

    # Recursive split on each section if it exceeds chunk_size
    fine_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    result: list[LCDocument] = fine_splitter.split_documents(section_docs)

    return result


# ---------------------------------------------------------------------------
# Stage 8 — Real Qdrant persistence and cleanup
# ---------------------------------------------------------------------------


def _persist_chunks(document_id: str, chunks: list[dict]) -> None:
    """Persist chunks to the Qdrant vector store.

    Delegates to :func:`qdrant_service.upsert_documents` which handles
    embedding generation and upsert.

    Raises
    ------
    RuntimeError
        If the upsert returns zero points written (all chunks skipped).
    """
    if not chunks:
        logger.warning("No chunks to persist for document_id=%s", document_id)
        return

    from app.services.qdrant_service import upsert_documents

    count = upsert_documents(chunks)
    if count == 0:
        raise RuntimeError(
            f"Qdrant upsert returned 0 points written for document_id={document_id} "
            f"(all {len(chunks)} chunks were skipped)"
        )
    logger.info(
        "Persisted %d/%d chunks to Qdrant for document_id=%s",
        count, len(chunks), document_id,
    )


def _cleanup_old_chunks(document_id: str) -> None:
    """Remove previously persisted chunks for *document_id* from Qdrant.

    Delegates to :func:`qdrant_service.delete_by_document_id`.
    """
    from app.services.qdrant_service import delete_by_document_id

    deleted = delete_by_document_id(document_id)
    logger.info(
        "Cleaned up %d old Qdrant chunks for document_id=%s",
        deleted, document_id,
    )
