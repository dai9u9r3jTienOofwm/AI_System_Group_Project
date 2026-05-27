"""
Ingestion pipeline service (Stage 7 — hybrid topic classification + parallel work).

Orchestrates the full ingestion lifecycle for a single document:
  queue → processing → completed | failed

Main improvements in this version:
- Keeps the ingestion flow quality-oriented instead of relying on file extension only.
- Uses a hybrid topic classifier that combines:
    1. user/admin selected topic, if available
    2. weak content-type prior
    3. filename signal
    4. keyword/content signal
    5. LLM classifier signal
- Runs topic classification and chunking in parallel after parsing because they are
  independent read-only operations over the parsed document content.
- Persists chunks to Qdrant in configurable batches and can optionally upsert
  several batches in parallel.
- Adds timing logs for every major stage so bottlenecks are visible in production.

Notes:
- Extension/content_type is only a weak prior, never the only decision path.
- The document is marked completed only after topic classification, chunking,
  metadata enrichment, and all Qdrant upserts have succeeded.
"""

from __future__ import annotations

import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import perf_counter
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

# Topic classification settings.
MAX_TOPIC_SAMPLE_CHARS: int = 6000
MIN_TOPIC_CONFIDENCE: float = 0.18
ENABLE_LLM_TOPIC_CLASSIFIER: bool = os.getenv(
    "INGESTION_ENABLE_LLM_TOPIC_CLASSIFIER",
    "true",
).lower() in {"1", "true", "yes", "on"}

# Qdrant persistence settings.
UPSERT_BATCH_SIZE: int = int(os.getenv("INGESTION_UPSERT_BATCH_SIZE", "64"))
UPSERT_MAX_WORKERS: int = int(os.getenv("INGESTION_UPSERT_MAX_WORKERS", "2"))

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
    "Mixture of Experts",
]

_DROPDOWN_BY_LOWER: dict[str, str] = {topic.lower(): topic for topic in _DROPDOWN}

# This is only a weak prior, not the main classifier.
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

_TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "General Python Programming": (
        "python", "pip", "virtualenv", "venv", "pytest", "pydantic",
        "fastapi", "django", "flask", "numpy", "pandas", "list comprehension",
        "decorator", "async def", "__init__", "class ", "def ",
    ),
    "Low-Level & Assembly": (
        "assembly", "asm", "register", "interrupt", "syscall", "stack pointer",
        "x86", "arm", "risc", "opcode", "memory address", "segmentation",
        "mov", "push", "pop", "jmp", "cmp",
    ),
    "General C/C++ Programming": (
        "c++", "cpp", "#include", "std::", "iostream", "pointer", "malloc",
        "free", "struct", "template", "namespace", "nullptr", "header file",
        "segmentation fault", "g++", "gcc",
    ),
    "Software Architecture": (
        "architecture", "microservice", "monolith", "design pattern", "clean architecture",
        "domain", "service layer", "repository", "event-driven", "cqrs",
        "bounded context", "uml", "component diagram", "sequence diagram",
    ),
    "DevOps Deployment Guides": (
        "docker", "dockerfile", "docker compose", "compose.yml", "nginx", "deployment",
        "ci/cd", "pipeline", "github actions", "gitlab ci", "kubernetes", "helm",
        "container", "reverse proxy", "load balancer", "uvicorn", "gunicorn",
    ),
    "Infrastructure as Code": (
        "terraform", "ansible", "cloudformation", "pulumi", "yaml", "yml",
        "kubernetes manifest", "deployment.yaml", "service.yaml", "ingress",
        "infrastructure as code", "iac", "provision", "helm chart",
    ),
    "System Logs & Monitoring": (
        "log", "logs", "monitoring", "prometheus", "grafana", "alert", "alertmanager",
        "trace", "tracing", "metric", "metrics", "observability", "elk", "kibana",
        "error log", "access log", "latency", "throughput",
    ),
    "API Specifications": (
        "api", "openapi", "swagger", "endpoint", "request", "response", "status code",
        "rest", "graphql", "grpc", "post /", "get /", "put /", "delete /",
        "schema", "payload", "jwt", "oauth",
    ),
    "Data Structures & Schemas": (
        "schema", "database schema", "json schema", "table", "column", "primary key",
        "foreign key", "index", "erd", "entity relationship", "data structure",
        "linked list", "tree", "graph", "hash table", "queue", "stack",
    ),
    "Project Management & Agile": (
        "agile", "scrum", "kanban", "sprint", "backlog", "user story", "story point",
        "retrospective", "roadmap", "timeline", "milestone", "task", "jira",
        "acceptance criteria", "project plan",
    ),
    "Project Technical Documentation": (
        "documentation", "technical documentation", "overview", "introduction", "requirement",
        "setup", "installation", "usage", "manual", "guide", "readme", "report",
        "module", "workflow", "system description",
    ),
    "Deep Learning": (
        "deep learning", "neural network", "cnn", "rnn", "lstm", "transformer",
        "attention", "backpropagation", "gradient descent", "loss function", "pytorch",
        "tensorflow", "embedding", "fine-tuning", "training", "inference",
    ),
    "Frontend Programming": (
        "frontend", "react", "next.js", "vue", "angular", "typescript", "javascript",
        "tsx", "jsx", "component", "tailwind", "css", "html", "browser", "ui",
        "useeffect", "usestate", "client component",
    ),
    "Backend Programming": (
        "backend", "fastapi", "express", "nest.js", "spring", "django", "flask",
        "controller", "service", "router", "middleware", "database", "postgresql",
        "redis", "authentication", "authorization", "sqlalchemy", "orm",
    ),
    "AI Agent": (
        "agent", "ai agent", "tool calling", "function calling", "planner", "executor",
        "memory", "langchain", "langgraph", "autogen", "crew ai", "multi-agent",
        "reasoning", "reflection", "retriever tool",
    ),
    "Mixture of Experts": (
        "mixture of experts", "moe", "expert routing", "router", "sparse expert",
        "top-k expert", "gating network", "switch transformer", "expert parallelism",
        "load balancing loss", "auxiliary loss",
    ),
}


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def load_document(file_path: str) -> list[LCDocument]:
    """Backward-compatible local-file loader for tests or old imports."""
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

    Optimized logic:
    1. Parse once.
    2. Run hybrid topic classification and chunking in parallel.
    3. Enrich chunks with the final topic.
    4. Batch/parallel persist to Qdrant.
    5. Mark the document completed only after all writes succeed.
    """
    db: Session = SessionLocal()
    minio_service: MinioService = get_client()
    total_t0 = perf_counter()

    try:
        # ── 1. Load metadata ──────────────────────────────────────────
        t0 = perf_counter()
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
        _log_stage_time("load_metadata", t0)

        # ── 2. Download from MinIO ────────────────────────────────────
        t0 = perf_counter()
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
        _log_stage_time("download_minio", t0)

        # ── 3. Detect and validate file type ──────────────────────────
        file_ext = _get_extension(doc.filename)
        _validate_extension(file_ext)
        content_type = _detect_content_type(file_ext)
        logger.info("Detected content_type=%s extension=%s", content_type, file_ext)

        # ── 4. Parse raw bytes ────────────────────────────────────────
        t0 = perf_counter()
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
        _log_stage_time("parse_content", t0)

        # ── 5. Run independent work in parallel ───────────────────────
        # Topic classification and chunking both read parsed_docs only.
        # They do not need to block each other.
        t0 = perf_counter()
        selected_topic = getattr(doc, "topic", None)
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix="ingest") as executor:
            topic_future = executor.submit(
                _predict_topic_hybrid,
                parsed_docs,
                content_type,
                doc.filename,
                selected_topic,
            )
            chunk_future = executor.submit(
                _chunk_documents,
                parsed_docs,
                content_type,
                DEFAULT_CHUNK_SIZE,
                DEFAULT_CHUNK_OVERLAP,
            )

            predicted_topic = topic_future.result()
            chunked_docs = chunk_future.result()

        logger.info("Final predicted_topic=%r", predicted_topic)
        _log_stage_time("parallel_topic_and_chunk", t0)

        chunked_docs = _drop_empty_documents(chunked_docs)
        if not chunked_docs:
            raise ValueError(
                f"Chunking produced 0 non-empty chunks for document_id={document_id}, "
                f"filename={doc.filename}."
            )

        # ── 6. Attach stable metadata to every chunk ──────────────────
        t0 = perf_counter()
        enriched_chunks = _enrich_chunks(
            chunked_docs=chunked_docs,
            document_id=document_id,
            filename=doc.filename,
            content_type=content_type,
            file_ext=file_ext,
            minio_bucket=doc.minio_bucket,
            minio_object_name=doc.minio_object_name,
            topic=predicted_topic,
            uploaded_by=doc.uploaded_by,
        )
        _log_stage_time("enrich_chunks", t0)

        # ── 7. Persist chunks ─────────────────────────────────────────
        t0 = perf_counter()
        persisted_count = _persist_chunks(document_id, enriched_chunks)
        chunk_count = len(enriched_chunks)
        if persisted_count != chunk_count:
            raise RuntimeError(
                f"Qdrant persisted {persisted_count}/{chunk_count} chunks for "
                f"document_id={document_id}. Refusing to mark completed."
            )
        _log_stage_time("persist_qdrant", t0)

        # ── 8. Status → completed ─────────────────────────────────────
        t0 = perf_counter()
        postgres_client.update_document_status(
            db,
            document_id,
            status="completed",
            chunk_count=chunk_count,
            topic=predicted_topic,
            error_message=None,
        )
        _log_stage_time("update_completed_status", t0)

        logger.info(
            "Ingestion complete for document_id=%s filename=%s (%d chunks) total=%.3fs",
            document_id,
            doc.filename,
            chunk_count,
            perf_counter() - total_t0,
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
    """Remove existing chunks for *document_id*, then re-run ingestion."""
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

def _log_stage_time(stage_name: str, start_time: float) -> None:
    logger.info("Ingestion stage %-28s took %.3fs", stage_name, perf_counter() - start_time)


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
# Hybrid topic classification
# ---------------------------------------------------------------------------

def _predict_topic_hybrid(
    parsed_docs: list[LCDocument],
    content_type: str,
    filename: str,
    user_topic: str | None = None,
) -> str:
    """
    Predict topic using multiple signals.

    This is intentionally hybrid:
    - user/admin selected topic has high weight when valid;
    - content_type/extension is only a weak prior;
    - filename and content keywords provide deterministic signals;
    - LLM classifier resolves semantic cases that rules cannot handle.
    """
    fallback_topic = _FALLBACK_TOPIC_BY_CONTENT_TYPE.get(
        content_type,
        "Project Technical Documentation",
    )

    sample = _build_topic_sample(parsed_docs, max_chars=MAX_TOPIC_SAMPLE_CHARS)
    if not sample.strip():
        return _normalise_topic_name(user_topic) or fallback_topic

    scores: dict[str, float] = {topic: 0.0 for topic in _DROPDOWN}

    # 1. User/admin selected topic: strong signal, but still not exclusive.
    selected_topic = _normalise_topic_name(user_topic)
    if selected_topic:
        _add_topic_score(scores, selected_topic, 0.35)

    # 2. Weak content-type prior. This avoids "extension guessing" dominating.
    prior_topic = _normalise_topic_name(fallback_topic)
    if prior_topic:
        _add_topic_score(scores, prior_topic, 0.08)

    # 3. Filename signal.
    filename_scores = _keyword_topic_scores(filename or "")
    _add_weighted_scores(scores, filename_scores, weight=0.12)

    # 4. Content keyword signal.
    content_scores = _keyword_topic_scores(sample)
    _add_weighted_scores(scores, content_scores, weight=0.25)

    # 5. LLM semantic classifier signal.
    if ENABLE_LLM_TOPIC_CLASSIFIER:
        llm_topic = _predict_topic_with_llm(sample)
        if llm_topic:
            _add_topic_score(scores, llm_topic, 0.35)

    best_topic, confidence = max(scores.items(), key=lambda item: item[1])

    if confidence < MIN_TOPIC_CONFIDENCE:
        logger.info(
            "Hybrid topic confidence %.3f below threshold %.3f; fallback=%r",
            confidence,
            MIN_TOPIC_CONFIDENCE,
            fallback_topic,
        )
        return selected_topic or fallback_topic

    logger.info(
        "Hybrid topic selected=%r confidence=%.3f top_scores=%s",
        best_topic,
        confidence,
        _top_topic_scores(scores, limit=5),
    )
    return best_topic


# Backward-compatible name for older tests/imports.
def _predict_topic(parsed_docs: list[LCDocument], content_type: str) -> str:
    return _predict_topic_hybrid(parsed_docs, content_type, filename="", user_topic=None)


def _build_topic_sample(docs: list[LCDocument], max_chars: int) -> str:
    parts: list[str] = []
    total = 0
    for doc in docs:
        text = (doc.page_content or "").strip()
        if not text:
            continue
        remaining = max_chars - total
        if remaining <= 0:
            break
        piece = text[:remaining]
        parts.append(piece)
        total += len(piece)
    return "\n\n".join(parts)[:max_chars]


def _normalise_topic_name(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    if cleaned in _DROPDOWN:
        return cleaned
    return _DROPDOWN_BY_LOWER.get(cleaned.lower())


def _add_topic_score(scores: dict[str, float], topic: str, value: float) -> None:
    normalised = _normalise_topic_name(topic)
    if normalised:
        scores[normalised] = scores.get(normalised, 0.0) + value


def _add_weighted_scores(
    scores: dict[str, float],
    partial_scores: dict[str, float],
    weight: float,
) -> None:
    for topic, score in partial_scores.items():
        if score <= 0:
            continue
        _add_topic_score(scores, topic, weight * min(score, 1.0))


def _keyword_topic_scores(text: str) -> dict[str, float]:
    """Return normalized keyword scores in the range [0, 1] per topic."""
    lowered = f" {text.lower()} "
    scores: dict[str, float] = {}

    for topic, keywords in _TOPIC_KEYWORDS.items():
        matched = 0
        for keyword in keywords:
            if keyword.lower() in lowered:
                matched += 1
        if matched:
            # More than six matched keywords usually means the topic is very clear.
            scores[topic] = min(1.0, matched / 6.0)

    return scores


def _predict_topic_with_llm(sample: str) -> str | None:
    try:
        llm = generation_service._get_llm()
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You classify a document into exactly one category. "
                    "Use semantic meaning, not just file extension. "
                    "Return only the category name. "
                    f"Allowed categories: {', '.join(_DROPDOWN)}.",
                ),
                ("user", "Document content:\n\n{content}"),
            ]
        )
        response = (prompt | llm).invoke({"content": sample})
        raw_topic = str(response.content).strip()
        predicted_topic = _normalise_topic_name(raw_topic)
        logger.info("Raw topic prediction from LLM: %r normalised=%r", raw_topic, predicted_topic)
        return predicted_topic
    except Exception as exc:
        logger.warning("LLM topic prediction failed; continuing without it. Error: %s", exc)
        return None


def _top_topic_scores(scores: dict[str, float], limit: int = 5) -> dict[str, float]:
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:limit]
    return {topic: round(score, 4) for topic, score in ranked if score > 0}


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


def _enrich_chunks(
    chunked_docs: list[LCDocument],
    document_id: str,
    filename: str,
    content_type: str,
    file_ext: str,
    minio_bucket: str,
    minio_object_name: str,
    topic: str,
    uploaded_by: str | None,
) -> list[dict[str, Any]]:
    base_metadata = _source_metadata(
        filename=filename,
        content_type=content_type,
        file_ext=file_ext,
    )
    base_metadata.update(
        {
            "document_id": document_id,
            "minio_bucket": minio_bucket,
            "minio_object_name": minio_object_name,
            "topic": topic,
            "uploaded_by": uploaded_by,
            "topic_method": "hybrid",
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

    return enriched_chunks


# ---------------------------------------------------------------------------
# Stage 8 — Qdrant persistence and cleanup
# ---------------------------------------------------------------------------

def _persist_chunks(document_id: str, chunks: list[dict[str, Any]]) -> int:
    """
    Persist chunks to the Qdrant vector store.

    Uses configurable batch size and optional parallel batch upsert.

    Environment knobs:
    - INGESTION_UPSERT_BATCH_SIZE: default 64
    - INGESTION_UPSERT_MAX_WORKERS: default 2
    """
    if not chunks:
        raise RuntimeError(f"No chunks to persist for document_id={document_id}")

    from app.services.qdrant_service import upsert_documents

    batches = list(_batched(chunks, max(1, UPSERT_BATCH_SIZE)))
    max_workers = max(1, min(UPSERT_MAX_WORKERS, len(batches)))

    logger.info(
        "Persisting %d chunks for document_id=%s in %d batch(es), max_workers=%d",
        len(chunks),
        document_id,
        len(batches),
        max_workers,
    )

    if max_workers == 1 or len(batches) == 1:
        total_count = 0
        for batch_idx, batch in enumerate(batches, start=1):
            count = upsert_documents(batch)
            logger.info(
                "Persisted batch %d/%d count=%d size=%d document_id=%s",
                batch_idx,
                len(batches),
                count,
                len(batch),
                document_id,
            )
            total_count += count
    else:
        total_count = 0
        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="qdrant-upsert") as executor:
            future_to_index = {
                executor.submit(upsert_documents, batch): (batch_idx, batch)
                for batch_idx, batch in enumerate(batches, start=1)
            }
            for future in as_completed(future_to_index):
                batch_idx, batch = future_to_index[future]
                count = future.result()
                logger.info(
                    "Persisted batch %d/%d count=%d size=%d document_id=%s",
                    batch_idx,
                    len(batches),
                    count,
                    len(batch),
                    document_id,
                )
                total_count += count

    if total_count == 0:
        raise RuntimeError(
            f"Qdrant upsert returned 0 points written for document_id={document_id} "
            f"(all {len(chunks)} chunks were skipped)"
        )

    logger.info(
        "Persisted %d/%d chunks to Qdrant for document_id=%s",
        total_count,
        len(chunks),
        document_id,
    )
    return total_count


def _batched(items: list[dict[str, Any]], batch_size: int) -> list[list[dict[str, Any]]]:
    return [items[i : i + batch_size] for i in range(0, len(items), batch_size)]


def _cleanup_old_chunks(document_id: str) -> None:
    """Remove previously persisted chunks for *document_id* from Qdrant."""
    from app.services.qdrant_service import delete_by_document_id

    deleted = delete_by_document_id(document_id)
    logger.info(
        "Cleaned up %d old Qdrant chunks for document_id=%s",
        deleted,
        document_id,
    )