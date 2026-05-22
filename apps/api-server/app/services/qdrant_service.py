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

# ===================================================================
# Embedding abstraction
# ===================================================================


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
    """Return an embedding model based on the configured provider.

    Resolution order:

    1. **OpenAI** — if ``settings.OPENAI_API_KEY`` is a non-empty, non-"None"
       value, return ``langchain_openai.OpenAIEmbeddings``.
    2. **Local fallback** — otherwise return a deterministic
       ``_FakeEmbeddings`` instance sized to ``settings.QDRANT_VECTOR_SIZE``.

    The local fallback logs a clear warning so operators know production
    embeddings are not active.
    """
    api_key = settings.OPENAI_API_KEY
    if api_key and isinstance(api_key, str) and api_key.strip() not in ("", "None"):
        try:
            from langchain_huggingface import HuggingFaceEmbeddings

            logger.info("Using local HuggingFaceEmbeddings: BAAI/bge-m3")

            return HuggingFaceEmbeddings(
                model_name="BAAI/bge-m3",
                model_kwargs={
                    "device": "cpu"
                },
                encode_kwargs={
                    "normalize_embeddings": True
                }
            )

        except Exception as exc:
            logger.warning(
                "Failed to initialise HuggingFaceEmbeddings (%s); "
                "falling back to local fake embeddings.",
                exc,
            )
            return FakeEmbeddings(size=1024)



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
    """Create the configured Qdrant collection if it does not already exist.

    Uses the following settings:
        - **QDRANT_COLLECTION** — collection name
        - **QDRANT_VECTOR_SIZE** — dimensionality of stored vectors
        - **Cosine** distance metric (standard for text embeddings)

    Idempotent — safe to call repeatedly.
    """
    client = get_client()
    collection_name = settings.QDRANT_COLLECTION
    vector_size = settings.QDRANT_VECTOR_SIZE

    existing = client.get_collections()
    names = {c.name for c in existing.collections}
    if collection_name in names:
        logger.debug("Collection '%s' already exists", collection_name)
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


def search_similar(question: str, topic: str = None, uploaded_by: str = None, filename: str = None, top_k: int = 5) -> list[dict[str, Any]]:
    """Search Qdrant for chunks semantically similar to *question*."""
    if not question or not question.strip():
        logger.warning("search_similar called with empty/blank question")
        return []

    embeddings_model = get_embeddings()
    client = get_client()
    ensure_collection()
    
    # 🌟 1. TẠO RỔ CHỨA ĐIỀU KIỆN 'AND' (MUST)
    must_conditions = []
    
    if topic:
        must_conditions.append(
            FieldCondition(
                key="metadata.topic",
                match=MatchValue(value=topic)
            )
        )
        
    # 🌟 CÚ CHỐT: Đẩy filename vào Qdrant Filter luôn. 
    # Thay vì tìm 50 chunks rồi dùng Python lọc, hãy ép Qdrant chỉ tìm trong file này!
    if filename:
        must_conditions.append(
            FieldCondition(
                key="metadata.filename",
                match=MatchValue(value=filename)
            )
        )
        
    # 🌟 2. TẠO RỔ CHỨA ĐIỀU KIỆN 'OR' (SHOULD)
    should_conditions = [
        FieldCondition(
            key="metadata.uploaded_by",
            match=MatchValue(value="admin")
        )
    ]
    
    if uploaded_by:
        # Ép kiểu str() để đảm bảo khớp 100% với kiểu chuỗi "2" lưu trong Qdrant
        should_conditions.append(
            FieldCondition(
                key="metadata.uploaded_by",
                match=MatchValue(value=str(uploaded_by))
            )
        )    
        
    must_conditions.append(Filter(should=should_conditions))

    chat_filter = Filter(must=must_conditions)

    # 🌟 3. THỰC THI TRUY VẤN
    query_vector = embeddings_model.embed_query(question)

    results = client.query_points(
        collection_name=settings.QDRANT_COLLECTION,
        query=query_vector,
        query_filter=chat_filter,
        limit=top_k, # Bỏ x10 đi, Qdrant đã lọc chuẩn rồi thì chỉ cần lấy đúng top_k
    )

    output = []
    for res in results.points:
        payload = res.payload or {}
        metadata = payload.get("metadata", {})
        print(f"SOI METADATA TỪ QDRANT: {metadata}")
        
        # 🌟 KHÔNG CẦN POST-FILTER BẰNG PYTHON NỮA!
        # Vì Qdrant đã lọc quá chuẩn, cái gì Qdrant trả về ta nhét thẳng vào output
        output.append(
            {
                "text": payload.get("text", ""),
                "score": res.score,
                "metadata": metadata,
            }
        )

    print(f"👉 Qdrant trả về chính xác {len(output)} chunks cho file '{filename}'")
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
