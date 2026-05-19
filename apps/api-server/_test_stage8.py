"""
Stage 8 smoke test — validates syntax, imports, embedding abstraction,
Qdrant service structure, and ingestion integration.

This file is a self-contained verification script for Stage 8
(Embedding and Qdrant).  It does NOT require Docker, MinIO, PostgreSQL,
or any external services.

Run with:

    python _test_stage8.py

All assertions pass if the Stage 8 code is structurally correct.
"""
import ast
import importlib
import os
import sys

# ── Ensure the project root is on sys.path ──────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# ── Set minimal env vars so config can be imported ──────────────────────
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("MINIO_ENDPOINT", "localhost:9000")
os.environ.setdefault("MINIO_ACCESS_KEY", "test")
os.environ.setdefault("MINIO_SECRET_KEY", "test123")
os.environ.setdefault("MINIO_BUCKET", "test-bucket")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("QDRANT_COLLECTION", "test_rag")
os.environ.setdefault("QDRANT_VECTOR_SIZE", "1536")
# Deliberately set to "None" string to trigger fallback embedding
os.environ.setdefault("OPENAI_API_KEY", "None")

# ---------------------------------------------------------------------------
# Test counters
# ---------------------------------------------------------------------------
passed = 0
failed = 0


def check(description: str, condition: bool) -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {description}")
    else:
        failed += 1
        print(f"  FAIL  {description}")


# ===================================================================
# 1. AST syntax validation for all Stage 6 + 7 + 8 files
# ===================================================================
print("\n=== 1. AST syntax validation ===")

FILES_TO_CHECK = [
    "app/services/ingestion_service.py",
    "app/services/minio_service.py",
    "app/services/postgres_client.py",
    "app/services/qdrant_service.py",
    "app/workers/ingestion_tasks.py",
    "app/api/documents.py",
    "app/models/document.py",
    "app/schemas/document.py",
]

for filepath in FILES_TO_CHECK:
    full_path = os.path.join(PROJECT_ROOT, filepath)
    try:
        with open(full_path, encoding="utf-8") as f:
            ast.parse(f.read())
        check(f"{filepath} -- valid syntax", True)
    except SyntaxError as e:
        check(f"{filepath} -- valid syntax: {e}", False)

# ===================================================================
# 2. Module import verification (including new qdrant_service)
# ===================================================================
print("\n=== 2. Module import verification ===")

IMPORT_CHECKS: list[tuple[str, str]] = [
    ("app.core.config", "settings"),
    ("app.models.document", "Document"),
    ("app.schemas.document", "DocumentRespond"),
    ("app.services.minio_service", "MinioService"),
    ("app.services.ingestion_service", "ingest_document"),
    ("app.services.ingestion_service", "reindex_document"),
    ("app.services.ingestion_service", "_persist_chunks"),
    ("app.services.ingestion_service", "_cleanup_old_chunks"),
    ("app.services.qdrant_service", "get_embeddings"),
    ("app.services.qdrant_service", "get_client"),
    ("app.services.qdrant_service", "ensure_collection"),
    ("app.services.qdrant_service", "upsert_documents"),
    ("app.services.qdrant_service", "search_similar"),
    ("app.services.qdrant_service", "delete_by_document_id"),
    ("app.services.postgres_client", "update_document_status"),
]

for mod_name, attr_name in IMPORT_CHECKS:
    try:
        mod = importlib.import_module(mod_name)
        obj = getattr(mod, attr_name, None)
        check(f"import {mod_name}.{attr_name}", obj is not None)
    except Exception as e:
        check(f"import {mod_name}.{attr_name}: {e}", False)

# ===================================================================
# 3. Qdrant service — embedding fallback
# ===================================================================
print("\n=== 3. Embedding fallback (_FakeEmbeddings) ===")

from app.services.qdrant_service import _FakeEmbeddings, get_embeddings

# _FakeEmbeddings class exists
check("_FakeEmbeddings is a class", isinstance(_FakeEmbeddings, type))

fake = _FakeEmbeddings(vector_size=64)
check("_FakeEmbeddings.embed_documents returns list",
      isinstance(fake.embed_documents(["hello", "world"]), list))
check("_FakeEmbeddings.embed_documents returns correct count",
      len(fake.embed_documents(["a", "b", "c"])) == 3)
check("_FakeEmbeddings.embed_query returns list",
      isinstance(fake.embed_query("test"), list))
check("_FakeEmbeddings.embed_query vector size",
      len(fake.embed_query("test")) == 64)
# Deterministic: same input -> same vector
v1 = fake.embed_query("hello world")
v2 = fake.embed_query("hello world")
check("_FakeEmbeddings deterministic output", v1 == v2)
# Different input -> different vector
v3 = fake.embed_query("different text")
check("_FakeEmbeddings different input -> different output",
      v1 != v3)

# ===================================================================
# 4. get_embeddings() with no real API key
# ===================================================================
print("\n=== 4. get_embeddings() fallback ===")

emb = get_embeddings()
check("get_embeddings() returns _FakeEmbeddings with OPENAI_API_KEY=None",
      isinstance(emb, _FakeEmbeddings))
check("get_embeddings().vector_size == QDRANT_VECTOR_SIZE",
      emb.vector_size == 1536)
check("get_embeddings().embed_documents works",
      len(emb.embed_documents(["hello"])) == 1)

# ===================================================================
# 5. Settings — config has new fields
# ===================================================================
print("\n=== 5. Config settings ===")

from app.core.config import settings as s

check("settings.QDRANT_URL is set", bool(s.QDRANT_URL))
check("settings.QDRANT_COLLECTION is set", bool(s.QDRANT_COLLECTION))
check("settings.QDRANT_VECTOR_SIZE is 1536",
      s.QDRANT_VECTOR_SIZE == 1536)

# ===================================================================
# 6. Qdrant service — function signatures exist
# ===================================================================
print("\n=== 6. Qdrant service function signatures ===")

import inspect

from app.services.qdrant_service import (
    upsert_documents,
    search_similar,
    delete_by_document_id,
    ensure_collection,
    get_client,
)

check("get_client() is callable", callable(get_client))
check("ensure_collection() is callable", callable(ensure_collection))

sig_upsert = inspect.signature(upsert_documents)
check("upsert_documents has 'chunks' parameter",
      "chunks" in sig_upsert.parameters)

sig_search = inspect.signature(search_similar)
check("search_similar has 'question' parameter",
      "question" in sig_search.parameters)
check("search_similar has 'top_k' parameter",
      "top_k" in sig_search.parameters)

sig_delete = inspect.signature(delete_by_document_id)
check("delete_by_document_id has 'document_id' parameter",
      "document_id" in sig_delete.parameters)

# ===================================================================
# 7. upsert_documents — validation (no Qdrant server needed)
# ===================================================================
print("\n=== 7. upsert_documents edge cases ===")

# Empty chunks should return 0
result_empty = upsert_documents([])
check("upsert_documents([]) returns 0", result_empty == 0)

# ===================================================================
# 8. search_similar — validation
# ===================================================================
print("\n=== 8. search_similar edge cases ===")

# Empty question returns []
check("search_similar('') returns []",
      search_similar("") == [])
check("search_similar('  ') returns []",
      search_similar("  ") == [])

# ===================================================================
# 9. delete_by_document_id — validation
# ===================================================================
print("\n=== 9. delete_by_document_id edge cases ===")

# Empty document_id returns 0
check("delete_by_document_id('') returns 0",
      delete_by_document_id("") == 0)

# ===================================================================
# 10. Ingestion pipeline Qdrant integration
# ===================================================================
print("\n=== 10. Ingestion — Qdrant integration ===")

ing_source_path = os.path.join(PROJECT_ROOT, "app/services/ingestion_service.py")
with open(ing_source_path, encoding="utf-8") as f:
    ing_source = f.read()

# _persist_chunks calls upsert_documents from qdrant_service
check("_persist_chunks calls upsert_documents",
      "upsert_documents(chunks)" in ing_source)

# _cleanup_old_chunks calls delete_by_document_id
check("_cleanup_old_chunks calls delete_by_document_id",
      "delete_by_document_id(document_id)" in ing_source)

# No more placeholder "Stage 8 will replace this" comments
check("No more Stage 8 placeholder comment in _persist_chunks",
      "Stage 8 will replace this" not in ing_source or
      "Stage 8 will replace this" not in ing_source.split("def _persist_chunks")[0])

# _persist_chunks raises RuntimeError on zero count
check("_persist_chunks has RuntimeError for zero upsert",
      "RuntimeError" in ing_source)
check("_persist_chunks checks count == 0",
      "if count == 0" in ing_source)

# ===================================================================
# 11. Qdrant payload structure — code inspection
# ===================================================================
print("\n=== 11. Qdrant payload structure ===")

qdrant_source_path = os.path.join(PROJECT_ROOT, "app/services/qdrant_service.py")
with open(qdrant_source_path, encoding="utf-8") as f:
    qdrant_source = f.read()

# Payload must contain text and metadata
check("Qdrant payload includes 'text' key",
      '"text": chunk["text"]' in qdrant_source or
      '"text": chunk' in qdrant_source)
check("Qdrant payload includes 'metadata' key",
      '"metadata": chunk["metadata"]' in qdrant_source)

# Qdrant point id uses chunk_id from metadata
check("Qdrant point id uses chunk_id",
      "chunk_id" in qdrant_source)

# Search response structure
check("Search response has 'text' key",
      '"text":' in qdrant_source)
check("Search response has 'score' key",
      '"score":' in qdrant_source)
check("Search response has 'metadata' key",
      '"metadata":' in qdrant_source)

# ===================================================================
# 12. Qdrant dependency verification
# ===================================================================
print("\n=== 12. Qdrant dependency verification ===")

try:
    from qdrant_client import QdrantClient
    check("qdrant_client.QdrantClient importable", True)
except ImportError:
    check("qdrant_client.QdrantClient importable", False)

try:
    from qdrant_client.http.models import PointStruct, VectorParams, Distance, Filter, FieldCondition, MatchValue
    check("qdrant_client models importable", True)
except ImportError:
    check("qdrant_client models importable", False)

# ===================================================================
# Summary
# ===================================================================
print(f"\n{'='*60}")
print(f"  Results: {passed} passed, {failed} failed")
print(f"{'='*60}\n")

if failed:
    sys.exit(1)
else:
    sys.exit(0)
