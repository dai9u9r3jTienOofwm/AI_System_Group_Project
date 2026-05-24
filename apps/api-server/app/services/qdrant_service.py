"""
Qdrant vector-store service (Stage 8 — embedding and Qdrant integration).

Provides a clean abstraction over Qdrant for the ingestion pipeline:

- ``get_embeddings()`` — returns an embedding model based on ``settings.LLM_PROVIDER``
  and configured API keys.  Falls back to deterministic local embeddings when no
  real provider is available (dev/test safety).
- ``get_client()`` — singleton ``QdrantClient`` connected to ``settings.QDRANT_URL``.
- ``ensure_collection()`` — idempotent collection creation with configured vector
  size and Cosine distance.
- ``upsert_documents(chunks)`` — embed text chunks, upsert into Qdrant with
  payload containing both ``text`` and ``metadata``.
- ``search_similar(question, top_k)`` — embed query, search Qdrant, return
  results with ``text``, ``score``, ``metadata``.
- ``delete_by_document_id(document_id)`` — delete all points whose payload
  ``metadata.document_id`` matches.
"""

import hashlib
import logging
from typing import Any
import uuid
import re

from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)
from qdrant_client.models import MatchText

from app.core.config import settings

logger = logging.getLogger(__name__)

_embeddings_model = None


_collection_ready: bool = False
# ===================================================================
# Embedding abstraction
# ===================================================================

_ALLOWED_FILENAME_EXTENSIONS = "pdf|md|txt|py|c|cpp|h|asm|yml|yaml|json"

def extract_requested_filename(query: str) -> str | None:
    if not query:
        return None

    pattern = rf"\b[\w\-.]+\.(?:{_ALLOWED_FILENAME_EXTENSIONS})\b"
    match = re.search(pattern, query, flags=re.IGNORECASE)

    return match.group(0) if match else None


class _FakeEmbeddings:
    """Deterministic local/test embedding fallback.

    Produces a fixed-dimension vector using a hash of the input text,
    seeded by the byte value.  This is **not** semantically meaningful –
    it exists solely so the ingestion pipeline can be exercised without
    a real embedding API key.

    Only activated when ``settings.OPENAI_API_KEY`` is unset, ``None``,
    or the literal string ``"None"``.
    """

    def __init__(self, vector_size: int = 1024) -> None:
        self.vector_size = vector_size

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)

    def _embed(self, text: str) -> list[float]:
        h = hashlib.sha256(text.encode("utf-8")).digest()
        return [((h[i % 32] + i) % 256) / 255.0 for i in range(self.vector_size)]



def get_embeddings():
    global _embeddings_model

    if _embeddings_model is not None:
        return _embeddings_model

    try:
        from langchain_huggingface import HuggingFaceEmbeddings

        logger.info("Loading local HuggingFaceEmbeddings: BAAI/bge-m3")

        _embeddings_model = HuggingFaceEmbeddings(
            model_name="BAAI/bge-m3",
            model_kwargs={
                "device": "cpu",
            },
            encode_kwargs={
                "normalize_embeddings": True,
                "batch_size": 8,
            },
        )

        logger.info("Embedding model loaded successfully")
        return _embeddings_model

    except Exception as exc:
        logger.warning(
            "Failed to initialise HuggingFaceEmbeddings (%s); "
            "falling back to deterministic fake embeddings.",
            exc,
        )

        _embeddings_model = _FakeEmbeddings(
            vector_size=settings.QDRANT_VECTOR_SIZE
        )
        return _embeddings_model


# ===================================================================
# Qdrant client singleton
# ===================================================================

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    """Return a singleton :class:`QdrantClient` connected to
    ``settings.QDRANT_URL``."""
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.QDRANT_URL)
        logger.info("QdrantClient initialised for %s", settings.QDRANT_URL)
    return _client


# ===================================================================
# Collection management
# ===================================================================


def ensure_collection() -> None:
    global _collection_ready

    if _collection_ready:
        return

    client = get_client()
    collection_name = settings.QDRANT_COLLECTION
    vector_size = settings.QDRANT_VECTOR_SIZE

    existing = client.get_collections()
    names = {c.name for c in existing.collections}

    if collection_name in names:
        logger.debug("Collection '%s' already exists", collection_name)
        _collection_ready = True
        return

    logger.info(
        "Creating collection '%s' (vector_size=%d, distance=Cosine)",
        collection_name,
        vector_size,
    )

    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )

    _collection_ready = True
    logger.info("Collection '%s' created successfully", collection_name)


# ===================================================================
# Upsert (ingestion)
# ===================================================================


def upsert_documents(chunks: list[dict[str, Any]]) -> int:
    """Generate embeddings for *chunks* and upsert them into Qdrant.

    Each item in *chunks* **must** contain:
        - ``text`` (str) — the chunk's textual content
        - ``metadata`` (dict) — payload metadata that **must** include
          ``chunk_id`` (used as the Qdrant point ID for idempotent upsert)

    Returns the number of points successfully upserted.
    """
    if not chunks:
        logger.warning("upsert_documents called with empty chunks list")
        return 0

    embeddings_model = get_embeddings()
    client = get_client()
    ensure_collection()

    texts = [c["text"] for c in chunks]
    vectors = embeddings_model.embed_documents(texts)

    points: list[PointStruct] = []
    print(f" LOG ĐIỀU TRA: Có {len(chunks)} chunks và {len(vectors)} vectors.")
    for idx,  (chunk, vector) in enumerate(zip(chunks, vectors)):
        document_id = chunks[0]["metadata"].get("document_id")
        
        if not document_id:
            raise ValueError("Cannot find document id")
        namespace_uuid = uuid.UUID(str(document_id))
        
        point_id = str(uuid.uuid5(namespace_uuid, f"chunk_{idx}"))
        if not point_id:
            logger.error("Chunk missing 'chunk_id' in metadata — skipping")
            continue
        points.append(
            PointStruct(
                id=point_id,
                vector=vector,
                payload={"text": chunk["text"], "metadata": chunk["metadata"]},
            )
        )

    if not points:
        logger.warning("No valid points to upsert after filtering")
        return 0
    print(f" LOG ĐIỀU TRA: Tổng số points chuẩn bị bắn lên Qdrant là: {len(points)}")
    client.upsert(
        collection_name=settings.QDRANT_COLLECTION,
        points=points,
    )
    logger.info(
        "Upserted %d points to collection '%s'",
        len(points),
        settings.QDRANT_COLLECTION,
    )
    return len(points)


# ===================================================================
# Search (retrieval)
# ===================================================================


ADMIN_UPLOADER_VALUE = "admin"
DEFAULT_FILENAME_SCROLL_LIMIT = 200


def _normalise_optional_str(value: Any) -> str | None:
    """Return a stripped string, or None for empty values."""
    if value is None:
        return None
    value_str = str(value).strip()
    return value_str or None


def _access_control_condition(uploaded_by: str | None):
    """
    Build the access-control part of the Qdrant filter.

    Policy:
    - Anonymous / unknown current user: can only read admin-uploaded documents.
    - Logged-in user: can read admin-uploaded documents OR documents uploaded by
      exactly that same user.

    This prevents user B from retrieving chunks uploaded by user A.
    """
    current_user = _normalise_optional_str(uploaded_by)

    admin_condition = FieldCondition(
        key="metadata.uploaded_by",
        match=MatchValue(value=ADMIN_UPLOADER_VALUE),
    )

    if not current_user:
        return admin_condition

    user_condition = FieldCondition(
        key="metadata.uploaded_by",
        match=MatchValue(value=current_user),
    )

    # Qdrant semantics here:
    # outer Filter(must=[..., Filter(should=[admin_condition, user_condition])])
    # means: (...other constraints...) AND (uploaded_by == admin OR uploaded_by == current_user)
    return Filter(should=[admin_condition, user_condition])


def _build_chat_filter(
    *,
    topic: str | None = None,
    uploaded_by: str | None = None,
    filename: str | None = None,
) -> Filter:
    """
    Build Qdrant payload filter safely.

    Important rule:
    - If filename is provided, do NOT also require topic. Filename-specific
      questions must not fail just because the topic classifier guessed a
      different topic.
    - Access control is always added.
    """
    must_conditions = []

    clean_filename = _normalise_optional_str(filename)
    clean_topic = _normalise_optional_str(topic)

    if clean_filename:
        must_conditions.append(
            FieldCondition(
                key="metadata.filename",
                match=MatchValue(value=clean_filename),
            )
        )
    elif clean_topic:
        must_conditions.append(
            FieldCondition(
                key="metadata.topic",
                match=MatchValue(value=clean_topic),
            )
        )

    must_conditions.append(_access_control_condition(uploaded_by))
    return Filter(must=must_conditions)


def _payload_to_result(payload: dict[str, Any], score: float | None = None) -> dict[str, Any] | None:
    """Convert a Qdrant payload to the result shape used by chat generation."""
    metadata = payload.get("metadata") or {}
    text = (
        payload.get("text")
        or payload.get("page_content")
        or payload.get("content")
        or payload.get("document")
        or ""
    )

    if not isinstance(text, str) or not text.strip():
        return None

    return {
        "text": text,
        "score": 1.0 if score is None else score,
        "metadata": metadata,
    }


def get_chunks_by_filename(
    filename: str,
    *,
    uploaded_by: str | None = None,
    limit: int = DEFAULT_FILENAME_SCROLL_LIMIT,
    max_chunks: int = 500,
) -> list[dict[str, Any]]:
    """
    Retrieve chunks for one exact filename using Qdrant payload filtering.

    This path is used when the user explicitly mentions a file name.
    It does not use embeddings or semantic similarity.
    """

    clean_filename = _normalise_optional_str(filename)
    if not clean_filename:
        return []

    client = get_client()
    ensure_collection()

    chat_filter = _build_chat_filter(
        filename=clean_filename,
        uploaded_by=uploaded_by,
    )

    output: list[dict[str, Any]] = []
    next_offset = None

    while True:
        batch_limit = min(limit, max_chunks - len(output))

        if batch_limit <= 0:
            logger.warning(
                "Filename retrieval reached max_chunks=%d for filename=%s",
                max_chunks,
                clean_filename,
            )
            break

        points, next_offset = client.scroll(
            collection_name=settings.QDRANT_COLLECTION,
            scroll_filter=chat_filter,
            limit=batch_limit,
            offset=next_offset,
            with_payload=True,
            with_vectors=False,
        )

        if not points:
            break

        for point in points:
            payload = point.payload or {}
            item = _payload_to_result(payload, score=1.0)

            if not item:
                continue

            item["point_id"] = str(point.id)
            output.append(item)

        if next_offset is None:
            break

    output.sort(key=lambda x: x.get("metadata", {}).get("chunk_index", 0))

    logger.info(
        "Direct filename retrieval: filename=%s uploaded_by=%s chunks=%d",
        clean_filename,
        uploaded_by,
        len(output),
    )

    if output:
        first_meta = output[0].get("metadata", {})
        last_meta = output[-1].get("metadata", {})
        logger.info(
            "Direct filename retrieval metadata range: first=%s last=%s",
            {
                "filename": first_meta.get("filename"),
                "document_id": first_meta.get("document_id"),
                "chunk_index": first_meta.get("chunk_index"),
            },
            {
                "filename": last_meta.get("filename"),
                "document_id": last_meta.get("document_id"),
                "chunk_index": last_meta.get("chunk_index"),
            },
        )

    print(f"👉 Direct filename retrieval: {clean_filename} => {len(output)} chunks")

    return output

def search_similar(
    question: str,
    topic: str | None = None,
    uploaded_by: str | None = None,
    filename: str | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """
    Search Qdrant for chunks relevant to the question.

    Rules:
    - If a filename is provided or detected in the question:
      retrieve by metadata.filename directly.
    - Otherwise:
      run semantic vector search.
    """

    if not question or not question.strip():
        logger.warning("search_similar called with empty/blank question")
        return []

    safe_top_k = max(1, min(int(top_k or 5), 20))

    clean_filename = (
        _normalise_optional_str(filename)
        or extract_requested_filename(question)
    )

    # Critical rule:
    # filename-specific question must not use semantic search.
    if clean_filename:
        return get_chunks_by_filename(
            clean_filename,
            uploaded_by=uploaded_by,
            limit=DEFAULT_FILENAME_SCROLL_LIMIT,
            max_chunks=500,
        )

    embeddings_model = get_embeddings()
    client = get_client()
    ensure_collection()

    chat_filter = _build_chat_filter(
        topic=topic,
        uploaded_by=uploaded_by,
        filename=None,
    )

    query_vector = embeddings_model.embed_query(question)

    results = client.query_points(
        collection_name=settings.QDRANT_COLLECTION,
        query=query_vector,
        query_filter=chat_filter,
        limit=safe_top_k,
        with_payload=True,
    )

    output: list[dict[str, Any]] = []

    for res in results.points:
        payload = res.payload or {}
        item = _payload_to_result(payload, score=res.score)

        if not item:
            continue

        output.append(item)

    logger.info(
        "Semantic retrieval: topic=%s uploaded_by=%s top_k=%d chunks=%d",
        topic,
        uploaded_by,
        safe_top_k,
        len(output),
    )

    if output:
        logger.info(
            "Semantic retrieval first metadata: %s",
            output[0].get("metadata", {}),
        )

    print(f"👉 Qdrant semantic retrieval trả về {len(output)} chunks")

    return output
# ===================================================================
# Delete (reindex / cleanup)
# ===================================================================


def delete_by_document_id(document_id: str) -> int:
    """Delete all Qdrant points whose payload ``metadata.document_id`` matches.

    Returns the approximate number of points deleted (0 if none matched).
    """
    if not document_id:
        logger.warning("delete_by_document_id called with empty document_id")
        return 0

    client = get_client()
    ensure_collection()

    filter_condition = Filter(
        must=[
            FieldCondition(
                key="metadata.document_id",
                match=MatchValue(value=document_id),
            ),
        ],
    )

    # Count matching points first
    count_result = client.count(
        collection_name=settings.QDRANT_COLLECTION,
        count_filter=filter_condition,
    )
    count = count_result.count

    if count == 0:
        logger.info("No Qdrant points found for document_id=%s", document_id)
        return 0

    client.delete(
        collection_name=settings.QDRANT_COLLECTION,
        points_selector=filter_condition,
    )
    logger.info("Deleted %d Qdrant points for document_id=%s", count, document_id)
    return count
