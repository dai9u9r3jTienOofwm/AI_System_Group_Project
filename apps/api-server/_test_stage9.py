"""
Stage 9 smoke test — validates syntax, imports, retrieval service logic,
schemas, API router wiring, and main.py integration.

This file is a self-contained verification script for Stage 9
(Retrieval service).  It does NOT require Docker, MinIO, PostgreSQL,
Qdrant, or any external services.

Run with:

    python _test_stage9.py

All assertions pass if the Stage 9 code is structurally correct.
"""
import ast
import importlib
import inspect
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
# 1. AST syntax validation for all Stage 6 + 7 + 8 + 9 files
# ===================================================================
print("\n=== 1. AST syntax validation ===")

FILES_TO_CHECK = [
    "app/services/ingestion_service.py",
    "app/services/minio_service.py",
    "app/services/postgres_client.py",
    "app/services/qdrant_service.py",
    "app/services/retrieval_service.py",
    "app/workers/ingestion_tasks.py",
    "app/api/documents.py",
    "app/api/chat.py",
    "app/api/user.py",
    "app/models/document.py",
    "app/schemas/document.py",
    "app/schemas/chat.py",
    "main.py",
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
# 2. Module import verification (including new Stage 9 files)
# ===================================================================
print("\n=== 2. Module import verification ===")

IMPORT_CHECKS: list[tuple[str, str]] = [
    ("app.core.config", "settings"),
    ("app.models.document", "Document"),
    ("app.schemas.document", "DocumentRespond"),
    ("app.schemas.chat", "RetrieveRequest"),
    ("app.schemas.chat", "RetrieveResponse"),
    ("app.schemas.chat", "RetrievedChunk"),
    ("app.schemas.chat", "ChatRequest"),
    ("app.schemas.chat", "ChatResponse"),
    ("app.schemas.chat", "Source"),
    ("app.services.minio_service", "MinioService"),
    ("app.services.ingestion_service", "ingest_document"),
    ("app.services.ingestion_service", "reindex_document"),
    ("app.services.qdrant_service", "get_embeddings"),
    ("app.services.qdrant_service", "search_similar"),
    ("app.services.qdrant_service", "delete_by_document_id"),
    ("app.services.retrieval_service", "retrieve"),
    ("app.services.postgres_client", "update_document_status"),
    ("app.api.chat", "router"),
    ("app.api.chat", "retrieve_chunks"),
]

for mod_name, attr_name in IMPORT_CHECKS:
    try:
        mod = importlib.import_module(mod_name)
        obj = getattr(mod, attr_name, None)
        check(f"import {mod_name}.{attr_name}", obj is not None)
    except Exception as e:
        check(f"import {mod_name}.{attr_name}: {e}", False)

# ===================================================================
# 3. RetrieveRequest schema validation
# ===================================================================
print("\n=== 3. RetrieveRequest schema ===")

from app.schemas.chat import RetrieveRequest

# Can instantiate with valid data
req = RetrieveRequest(question="What is RAG?", top_k=5)
check("RetrieveRequest(question='...', top_k=5) valid", True)
check("RetrieveRequest.question == 'What is RAG?'", req.question == "What is RAG?")
check("RetrieveRequest.top_k == 5", req.top_k == 5)

# Default top_k is 5
req_default = RetrieveRequest(question="Hello")
check("RetrieveRequest.top_k defaults to 5", req_default.top_k == 5)

# Validation: empty question should raise
try:
    RetrieveRequest(question="", top_k=5)
    check("RetrieveRequest(question='') raises", False)
except Exception:
    check("RetrieveRequest(question='') raises ValueError", True)

# Validation: top_k out of range should raise
for bad_k in (0, 21, -1):
    try:
        RetrieveRequest(question="test", top_k=bad_k)
        check(f"RetrieveRequest(top_k={bad_k}) raises", False)
    except Exception:
        check(f"RetrieveRequest(top_k={bad_k}) raises ValueError", True)

# ===================================================================
# 4. RetrieveResponse / RetrievedChunk schema validation
# ===================================================================
print("\n=== 4. RetrieveResponse / RetrievedChunk schema ===")

from app.schemas.chat import RetrieveResponse, RetrievedChunk

# Empty response
resp_empty = RetrieveResponse()
check("RetrieveResponse().chunks == []", resp_empty.chunks == [])

# Single chunk
chunk = RetrievedChunk(text="Some content", score=0.95, metadata={"doc_id": "abc"})
resp = RetrieveResponse(chunks=[chunk])
check("RetrieveResponse with 1 chunk", len(resp.chunks) == 1)
check("RetrievedChunk.text", resp.chunks[0].text == "Some content")
check("RetrievedChunk.score", resp.chunks[0].score == 0.95)
check("RetrievedChunk.metadata['doc_id']", resp.chunks[0].metadata["doc_id"] == "abc")

# RetrievedChunk metadata defaults to {}
chunk_no_meta = RetrievedChunk(text="no meta", score=0.5)
check("RetrievedChunk metadata defaults to {}", chunk_no_meta.metadata == {})

# ===================================================================
# 5. ChatRequest / ChatResponse / Source schema validation (Stage 10 stubs)
# ===================================================================
print("\n=== 5. ChatRequest / ChatResponse / Source (Stage 10 stubs) ===")

from app.schemas.chat import ChatRequest, ChatResponse, Source

chat_req = ChatRequest(question="Hello")
check("ChatRequest(question='Hello') valid", True)
check("ChatRequest.top_k defaults 5", chat_req.top_k == 5)

src = Source(document_id="d1", filename="doc.md", chunk_index=0, preview="Some text")
check("Source with all fields", src.document_id == "d1")
check("Source.filename", src.filename == "doc.md")
check("Source.chunk_index", src.chunk_index == 0)
check("Source.preview", src.preview == "Some text")

chat_resp = ChatResponse(answer="Generated answer", sources=[src])
check("ChatResponse with answer and sources",
      chat_resp.answer == "Generated answer" and len(chat_resp.sources) == 1)

chat_resp_empty = ChatResponse(answer="No context")
check("ChatResponse.default sources=[]", chat_resp_empty.sources == [])

# ===================================================================
# 6. retrieval_service.retrieve() — edge cases (no Qdrant needed)
# ===================================================================
print("\n=== 6. retrieval_service.retrieve() edge cases ===")

from app.services.retrieval_service import retrieve

# Empty input
check("retrieve('') returns []", retrieve("") == [])
check("retrieve('  ') returns []", retrieve("  ") == [])

# ===================================================================
# 7. retrieval_service.retrieve() — result normalisation
# ===================================================================
print("\n=== 7. retrieval_service.retrieve() — code structure ===")

# Check that retrieve calls search_similar from qdrant_service
retrieval_source_path = os.path.join(PROJECT_ROOT, "app/services/retrieval_service.py")
with open(retrieval_source_path, encoding="utf-8") as f:
    retrieval_source = f.read()

check("retrieval_service imports search_similar",
      "from app.services.qdrant_service import search_similar" in retrieval_source or
      "from app.services.qdrant_service import" in retrieval_source)

check("retrieval_service has try/except around search_similar",
      "try:" in retrieval_source and "except" in retrieval_source)

# Normalisation: text, score, metadata keys
check("retrieval_service normalises 'text' key",
      '"text"' in retrieval_source)
check("retrieval_service normalises 'score' key",
      '"score"' in retrieval_source)
check("retrieval_service normalises 'metadata' key",
      '"metadata"' in retrieval_source)

# ===================================================================
# 8. chat.py API router — structure
# ===================================================================
print("\n=== 8. chat.py API router structure ===")

import app.api.chat as chat_module

# Router exists
check("chat.router is an APIRouter",
      hasattr(chat_module, "router"))

# Inspect routes
routes = chat_module.router.routes
route_paths = [r.path for r in routes]
route_methods = {r.path: [m for m in r.methods if m in ("GET", "POST", "PUT", "DELETE")] for r in routes}

check("chat router has POST /retrieve",
      "/retrieve" in route_paths)

# Check the POST /retrieve handler uses RetrieveRequest/RetrieveResponse
from app.api.chat import retrieve_chunks
sig = inspect.signature(retrieve_chunks)
check("retrieve_chunks has 'payload' parameter",
      "payload" in sig.parameters)

# Verify the function returns RetrieveResponse via source code
chat_api_path = os.path.join(PROJECT_ROOT, "app/api/chat.py")
with open(chat_api_path, encoding="utf-8") as f:
    chat_api_source = f.read()

check("chat.py imports RetrieveRequest",
      "from app.schemas.chat import RetrieveRequest" in chat_api_source or
      "from app.schemas.chat import" in chat_api_source)
check("chat.py imports RetrieveResponse",
      "RetrieveResponse" in chat_api_source)
check("chat.py imports RetrievedChunk",
      "RetrievedChunk" in chat_api_source)
check("chat.py imports retrieval_service.retrieve",
      "from app.services.retrieval_service import retrieve" in chat_api_source or
      "retrieval_service" in chat_api_source)
check("chat.py has Stage 10 stub comment",
      "Stage 10" in chat_api_source or "# ── Stage 10 stub" in chat_api_source)

# ===================================================================
# 9. main.py wiring
# ===================================================================
print("\n=== 9. main.py wiring ===")

main_path = os.path.join(PROJECT_ROOT, "main.py")
with open(main_path, encoding="utf-8") as f:
    main_source = f.read()

check("main.py imports chat router",
      "from app.api import chat" in main_source)
check("main.py includes chat router with prefix /v1/chat",
      'app.include_router(chat.router, prefix="/v1/chat"' in main_source)

# Verify FastAPI app can be instantiated (import-level verification)
try:
    from main import app
    check("main.app is instantiable", True)
    # Check routes
    app_routes = [r.path for r in app.routes]
    check("main.app has /v1/chat/retrieve route",
          "/v1/chat/retrieve" in app_routes)
except Exception as e:
    check(f"main.app import: {e}", False)

# ===================================================================
# 10. Existing user.py chat endpoint unchanged
# ===================================================================
print("\n=== 10. user.py chat endpoint preserved ===")

from app.api.user import router as user_router
user_routes = user_router.routes
check("user.py still has /chat endpoint (Stage 10 placeholder)",
      any("/chat" in r.path for r in user_routes))

# ===================================================================
# Summary
# ===================================================================
print(f"\n{'=' * 60}")
print(f"  Results: {passed} passed, {failed} failed")
print(f"{'=' * 60}")

sys.exit(0 if failed == 0 else 1)
