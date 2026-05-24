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
from app.db.session import SessionLocal
from app.services.minio_service import MinioService, get_client
from app.services import postgres_client, generation_service

# ── LangChain imports ──────────────────────────────────────────────────────
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document as LCDocument
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
    Language,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DEFAULT_CHUNK_SIZE: int = 1000
DEFAULT_CHUNK_OVERLAP: int = 200

# Keep this in sync with the upload API.
ALLOWED_EXTENSIONS: set[str] = {
    ".pdf", ".md", ".txt",
    ".py", ".c", ".cpp", ".h", ".asm",
    ".yml", ".yaml", ".json",
}

_LANGUAGE_SPLITTER_MAP: dict[str, Language] = {
    "python": Language.PYTHON,
    "c": Language.C,
    "cpp": Language.CPP,
}

_CODE_CONTENT_TYPES: set[str] = {
    "python",
    "c",
    "cpp",
    "c_header",
    "assembly",
}

_DROPDOWN: list[str] = [
    "General Python Programming",
    "Low-Level & Assembly",
    "General C/C++ Programming",
    "Software Architecture",
    "DevOps Deployment Guides",
    "Infrastructure as Code",
    "System Logs & Monitoring",
    "API Specifications",
    "Data Structures & Schemas",
    "Project Management & Agile",
    "Project Technical Documentation",
    "Deep Learning",
    "Frontend Programming",
    "Backend Programming",
    "AI Agent",
    "Mixture of Experts"
]

_FALLBACK_TOPIC_BY_CONTENT_TYPE: dict[str, str] = {
    "python": "General Python Programming",
    "c": "General C/C++ Programming",
    "cpp": "General C/C++ Programming",
    "c_header": "General C/C++ Programming",
    "assembly": "Low-Level & Assembly",
    "yaml": "Infrastructure as Code",
    "json": "Data Structures & Schemas",
    "markdown": "Project Technical Documentation",
    "text": "Project Technical Documentation",
    "pdf": "Project Technical Documentation",
}

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def load_document(file_path: str) -> list[LCDocument]:
    """Backward-compatible local-file loader for tests or old imports.

    The ingestion path below no longer uses this helper; it parses MinIO
    ``raw_bytes`` directly. Keeping this wrapper prevents old test code/imports
    from breaking.
    """
    filename = os.path.basename(file_path)
    file_ext = _get_extension(filename)
    _validate_extension(file_ext)
    content_type = _detect_content_type(file_ext)

    with open(file_path, "rb") as f:
        raw_bytes = f.read()

    return _parse_content(raw_bytes, content_type, filename)

def ingest_document(document_id: str) -> dict[str, Any]:
    """
    Full ingestion pipeline for a single document.

    Main fix compared with the old version:
    - Non-PDF files are parsed directly from ``raw_bytes`` into LangChain
      ``Document`` objects. This avoids losing code content through a temporary
      file loader.
    - ``source`` / ``filename`` / ``source_type`` metadata is attached before
      chunking and then forced again after chunking.
    """
    db: Session = SessionLocal()
    minio_service: MinioService = get_client()

    try:
        # ── 1. Load metadata ──────────────────────────────────────────
        doc = postgres_client.get_document(db, document_id)
        if doc is None:
            raise ValueError(f"Document {document_id} not found in database.")

        logger.info("Ingesting document_id=%s filename=%s", document_id, doc.filename)

        # ── 1b. Idempotency guard ─────────────────────────────────────
        if doc.status == "completed":
            logger.info(
                "Document %s already completed with %d chunks – skipping.",
                document_id,
                doc.chunk_count or 0,
            )
            return {
                "document_id": document_id,
                "filename": doc.filename,
                "status": "completed",
                "chunk_count": doc.chunk_count or 0,
                "topic": getattr(doc, "topic", None),
                "message": "Already ingested.",
            }

        postgres_client.update_document_status(db, document_id, status="processing")

        # ── 2. Download from MinIO ────────────────────────────────────
        raw_bytes: bytes = minio_service.download_file(
            bucket_name=doc.minio_bucket,
            object_name=doc.minio_object_name,
        )
        logger.info(
            "Downloaded %d bytes from MinIO (%s/%s)",
            len(raw_bytes),
            doc.minio_bucket,
            doc.minio_object_name,
        )

        # ── 3. Detect and validate file type ──────────────────────────
        file_ext = _get_extension(doc.filename)
        _validate_extension(file_ext)
        content_type = _detect_content_type(file_ext)
        logger.info("Detected content_type=%s extension=%s", content_type, file_ext)

        # ── 4. Parse raw bytes ────────────────────────────────────────
        parsed_docs = _parse_content(
            raw_bytes=raw_bytes,
            content_type=content_type,
            filename=doc.filename,
        )
        parsed_docs = _drop_empty_documents(parsed_docs)
        if not parsed_docs:
            raise ValueError(
                f"Parsed content is empty for document_id={document_id}, "
                f"filename={doc.filename}."
            )

        logger.info(
            "Parsed %d document(s), first_len=%d, metadata=%s",
            len(parsed_docs),
            len(parsed_docs[0].page_content or ""),
            parsed_docs[0].metadata,
        )

        # ── 5. Predict topic, but never let topic classification break ingestion
        predicted_topic = _predict_topic(parsed_docs, content_type)
        logger.info("Final predicted_topic=%r", predicted_topic)

        # ── 6. Chunk Documents ────────────────────────────────────────
        chunked_docs = _chunk_documents(
            docs=parsed_docs,
            content_type=content_type,
            chunk_size=DEFAULT_CHUNK_SIZE,
            chunk_overlap=DEFAULT_CHUNK_OVERLAP,
        )
        chunked_docs = _drop_empty_documents(chunked_docs)
        if not chunked_docs:
            raise ValueError(
                f"Chunking produced 0 non-empty chunks for document_id={document_id}, "
                f"filename={doc.filename}."
            )

        # ── 7. Attach stable metadata to every chunk ──────────────────
        base_metadata = _source_metadata(
            filename=doc.filename,
            content_type=content_type,
            file_ext=file_ext,
        )
        base_metadata.update(
            {
                "document_id": document_id,
                "minio_bucket": doc.minio_bucket,
                "minio_object_name": doc.minio_object_name,
                "topic": predicted_topic,
                "uploaded_by": doc.uploaded_by,
            }
        )

        enriched_chunks: list[dict[str, Any]] = []
        for idx, lc_doc in enumerate(chunked_docs):
            # Force base_metadata last so a splitter cannot overwrite source with
            # a temp file path or drop filename/source_type.
            merged = {**lc_doc.metadata, **base_metadata, "chunk_index": idx}
            merged["chunk_id"] = f"{document_id}_chunk_{idx:06d}"

            text = lc_doc.page_content
            enriched_chunks.append(
                {
                    "text": text,
                    "metadata": merged,
                }
            )

            if idx < 3:
                logger.info(
                    "Prepared chunk %d/%d len=%d metadata=%s preview=%r",
                    idx + 1,
                    len(chunked_docs),
                    len(text),
                    merged,
                    text[:160],
                )

        # ── 8. Persist chunks ─────────────────────────────────────────
        _persist_chunks(document_id, enriched_chunks)
        chunk_count = len(enriched_chunks)

        # ── 9. Status → completed ─────────────────────────────────────
        postgres_client.update_document_status(
            db,
            document_id,
            status="completed",
            chunk_count=chunk_count,
            topic=predicted_topic,
            error_message=None,
        )

        logger.info(
            "Ingestion complete for document_id=%s filename=%s (%d chunks)",
            document_id,
            doc.filename,
            chunk_count,
        )

        return {
            "document_id": document_id,
            "filename": doc.filename,
            "status": "completed",
            "chunk_count": chunk_count,
            "topic": predicted_topic,
            "message": "Ingestion completed successfully.",
        }

    except Exception as exc:
        logger.exception("Ingestion failed for document_id=%s", document_id)
        try:
            postgres_client.update_document_status(
                db,
                document_id,
                status="failed",
                error_message=str(exc),
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
    Remove existing chunks for *document_id*, then re-run ingestion.
    """
    logger.info("Reindex requested for document_id=%s", document_id)

    db: Session = SessionLocal()
    try:
        postgres_client.update_document_status(db, document_id, status="queued")
        _cleanup_old_chunks(document_id)
        return ingest_document(document_id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_extension(filename: str) -> str:
    """Return the lowercase file extension including the dot, e.g. ``.pdf``."""
    _, ext = os.path.splitext(filename or "")
    return ext.lower()


def _validate_extension(file_ext: str) -> None:
    if file_ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValueError(f"Unsupported file extension {file_ext!r}. Allowed: {allowed}")


def _detect_content_type(file_ext: str) -> str:
    """Map a file extension to a logical content-type label."""
    mapping = {
        ".pdf": "pdf",
        ".md": "markdown",
        ".txt": "text",
        ".py": "python",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c_header",
        ".asm": "assembly",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".json": "json",
    }
    return mapping.get(file_ext, "text")


def _source_metadata(filename: str, content_type: str, file_ext: str) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "source": filename,
        "filename": filename,
        "source_type": content_type,
        "file_extension": file_ext,
    }

    language = _language_for_content_type(content_type)
    if language:
        metadata["language"] = language

    return metadata


def _language_for_content_type(content_type: str) -> str | None:
    mapping = {
        "python": "python",
        "c": "c",
        "cpp": "cpp",
        "c_header": "c",
        "assembly": "assembly",
        "markdown": "markdown",
        "yaml": "yaml",
        "json": "json",
        "text": "text",
    }
    return mapping.get(content_type)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _parse_content(raw_bytes: bytes, content_type: str, filename: str) -> list[LCDocument]:
    """
    Parse raw file bytes into LangChain ``Document`` objects.

    PDF still needs ``PyPDFLoader`` because it extracts pages. All code/text
    formats are decoded directly from MinIO bytes so ``.py/.c/.cpp/.h/.asm``
    files cannot disappear because of a loader mismatch.
    """
    file_ext = _get_extension(filename)
    base_metadata = _source_metadata(filename, content_type, file_ext)

    if content_type == "pdf":
        pages = _parse_pdf(raw_bytes)
        for page in pages:
            page.metadata = {**base_metadata, **page.metadata}
            page.metadata["source"] = filename
            page.metadata["filename"] = filename
            page.metadata["source_type"] = content_type
        return pages

    text = _decode_text_bytes(raw_bytes, filename)
    if not text.strip():
        return []

    return [LCDocument(page_content=text, metadata=base_metadata)]


def _decode_text_bytes(raw_bytes: bytes, filename: str) -> str:
    """
    Decode source files robustly.

    Tries common encodings first. The final fallback uses replacement rather
    than dropping bytes, because preserving code text is more important than
    failing ingestion for a few unusual characters.
    """
    encodings = ("utf-8-sig", "utf-8", "utf-16", "cp1258", "latin-1")

    for encoding in encodings:
        try:
            text = raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue

        # Avoid accepting a wrong UTF-16 decode full of NULs.
        if text and (text.count("\x00") / max(len(text), 1)) > 0.2:
            continue

        logger.info("Decoded %s using encoding=%s", filename, encoding)
        return text

    logger.warning(
        "Could not decode %s cleanly; using utf-8 with replacement characters.",
        filename,
    )
    return raw_bytes.decode("utf-8", errors="replace")


def _parse_pdf(raw_bytes: bytes) -> list[LCDocument]:
    """Parse PDF bytes into page-level LangChain Documents using PyPDFLoader."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    try:
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()
        for page in pages:
            page.metadata.pop("source", None)  # remove temp-file path
            page.metadata.setdefault("page", 0)
        return pages
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _drop_empty_documents(docs: list[LCDocument]) -> list[LCDocument]:
    return [doc for doc in docs if (doc.page_content or "").strip()]


# ---------------------------------------------------------------------------
# Topic classification
# ---------------------------------------------------------------------------

def _predict_topic(parsed_docs: list[LCDocument], content_type: str) -> str:
    fallback_topic = _FALLBACK_TOPIC_BY_CONTENT_TYPE.get(
        content_type,
        "Project Technical Documentation",
    )

    sample = "\n\n".join(d.page_content for d in parsed_docs[:5])[:6000]
    if not sample.strip():
        return fallback_topic

    try:
        llm = generation_service._get_llm()
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "Your task is to assess document content and assign it to one "
                    "of the following categories based on its main topic: "
                    f"{', '.join(_DROPDOWN)}. Only choose one category that best "
                    "fits the document's main topic. Respond with only the category "
                    "name without any additional text. Output must be exactly one "
                    f"of: {', '.join(_DROPDOWN)}.",
                ),
                ("user", "Document content:\n\n{content}"),
            ]
        )
        response = (prompt | llm).invoke({"content": sample})
        predicted_topic = str(response.content).strip()
        logger.info("Raw topic prediction from LLM: %r", response.content)
    except Exception as exc:
        logger.warning(
            "Topic prediction failed for content_type=%s; using fallback=%r. Error: %s",
            content_type,
            fallback_topic,
            exc,
        )
        return fallback_topic

    if predicted_topic not in _DROPDOWN:
        logger.warning(
            "Invalid topic prediction=%r; using fallback=%r",
            predicted_topic,
            fallback_topic,
        )
        return fallback_topic

    return predicted_topic


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def _chunk_documents(
    docs: list[LCDocument],
    content_type: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[LCDocument]:
    """
    Split LangChain ``Document`` objects into smaller chunks.

    - Markdown: header-aware split first, then recursive split.
    - Python/C/C++: language-aware recursive splitter.
    - .h/.asm/.txt/.yaml/.json/PDF: plain recursive splitter.
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
    """Split markdown content while preserving original source metadata."""
    combined_text = "\n\n".join(d.page_content for d in docs if d.page_content.strip())
    if not combined_text.strip():
        return []

    inherited_metadata = _inherit_metadata(docs)

    headers_to_split_on = [
        ("#", "h1"),
        ("##", "h2"),
        ("###", "h3"),
    ]
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on,
        strip_headers=False,
    )

    section_docs = header_splitter.split_text(combined_text)
    if not section_docs:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )
        return splitter.split_documents(docs)

    for section_doc in section_docs:
        titles = []
        for h_key in ("h1", "h2", "h3"):
            val = section_doc.metadata.pop(h_key, None)
            if val:
                titles.append(str(val))

        section_doc.metadata = {**inherited_metadata, **section_doc.metadata}
        if titles:
            section_doc.metadata["section_title"] = " > ".join(titles)
        section_doc.metadata["language"] = "markdown"

    fine_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    return fine_splitter.split_documents(section_docs)


def _inherit_metadata(docs: list[LCDocument]) -> dict[str, Any]:
    """Take stable source metadata from the first parsed document."""
    if not docs:
        return {}

    wanted_keys = {
        "source",
        "filename",
        "source_type",
        "file_extension",
        "language",
        "page",
    }
    return {k: v for k, v in docs[0].metadata.items() if k in wanted_keys}


# ---------------------------------------------------------------------------
# Stage 8 — Qdrant persistence and cleanup
# ---------------------------------------------------------------------------

def _persist_chunks(document_id: str, chunks: list[dict[str, Any]]) -> None:
    """
    Persist chunks to the Qdrant vector store.

    Do not silently pass when the chunk list is empty. A document marked as
    completed with 0 searchable chunks is exactly the failure mode that makes
    RAG look like it ignored the uploaded file.
    """
    if not chunks:
        raise RuntimeError(f"No chunks to persist for document_id={document_id}")

    from app.services.qdrant_service import upsert_documents

    count = upsert_documents(chunks)
    if count == 0:
        raise RuntimeError(
            f"Qdrant upsert returned 0 points written for document_id={document_id} "
            f"(all {len(chunks)} chunks were skipped)"
        )

    logger.info(
        "Persisted %d/%d chunks to Qdrant for document_id=%s",
        count,
        len(chunks),
        document_id,
    )


def _cleanup_old_chunks(document_id: str) -> None:
    """Remove previously persisted chunks for *document_id* from Qdrant."""
    from app.services.qdrant_service import delete_by_document_id

    deleted = delete_by_document_id(document_id)
    logger.info(
        "Cleaned up %d old Qdrant chunks for document_id=%s",
        deleted,
        document_id,
    )
