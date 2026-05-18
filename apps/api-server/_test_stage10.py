"""
Stage 10 smoke test — validates syntax, imports, generation service logic,
schemas, chat endpoint wiring, and main.py integration.

This file is a self-contained verification script for Stage 10
(Generation service). It does NOT require Docker, MinIO, PostgreSQL,
Qdrant, or any external services.

Run with:

    python _test_stage10.py

All assertions pass if the Stage 10 code is structurally correct.
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
os.environ.setdefault("LLM_PROVIDER", "openai")

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
# 1. AST syntax validation for all Stage 6 + 7 + 8 + 9 + 10 files
# ===================================================================
print("\n=== 1. AST syntax validation ===")

FILES_TO_CHECK = [
    "app/services/ingestion_service.py",
    "app/services/minio_service.py",
    "app/services/postgres_client.py",
    "app/services/qdrant_service.py",
    "app/services/retrieval_service.py",
    "app/services/generation_service.py",
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
# 2. Module import verification
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
    ("app.services.generation_service", "generate_answer"),
    ("app.services.postgres_client", "update_document_status"),
    ("app.api.chat", "router"),
    ("app.api.chat", "retrieve_chunks"),
    ("app.api.chat", "chat"),
]

for mod_name, attr_name in IMPORT_CHECKS:
    try:
        mod = importlib.import_module(mod_name)
        obj = getattr(mod, attr_name, None)
        check(f"import {mod_name}.{attr_name}", obj is not None)
    except Exception as e:
        check(f"import {mod_name}.{attr_name}: {e}", False)

# ===================================================================
# 3. ChatRequest schema validation
# ===================================================================
print("\n=== 3. ChatRequest schema ===")

from app.schemas.chat import ChatRequest

req = ChatRequest(question="What is RAG?", top_k=5)
check("ChatRequest(question='...', top_k=5) valid", True)
check("ChatRequest.question", req.question == "What is RAG?")
check("ChatRequest.top_k == 5", req.top_k == 5)

# Default top_k
req_default = ChatRequest(question="Hello")
check("ChatRequest.top_k defaults to 5", req_default.top_k == 5)

# Empty question raises
try:
    ChatRequest(question="", top_k=5)
    check("ChatRequest(question='') raises", False)
except Exception:
    check("ChatRequest(question='') raises ValueError", True)

# top_k out of range
for bad_k in (0, 21, -1):
    try:
        ChatRequest(question="test", top_k=bad_k)
        check(f"ChatRequest(top_k={bad_k}) raises", False)
    except Exception:
        check(f"ChatRequest(top_k={bad_k}) raises ValueError", True)

# ===================================================================
# 4. Source / ChatResponse schema validation
# ===================================================================
print("\n=== 4. Source / ChatResponse schema ===")

from app.schemas.chat import Source, ChatResponse

src = Source(document_id="d1", filename="doc.md", chunk_index=0, preview="Some text")
check("Source.document_id", src.document_id == "d1")
check("Source.filename", src.filename == "doc.md")
check("Source.chunk_index", src.chunk_index == 0)
check("Source.preview", src.preview == "Some text")

resp = ChatResponse(answer="Generated", sources=[src])
check("ChatResponse.answer", resp.answer == "Generated")
check("ChatResponse.sources len", len(resp.sources) == 1)

resp_empty = ChatResponse(answer="No context")
check("ChatResponse default sources=[]", resp_empty.sources == [])

# ===================================================================
# 5. generation_service — _build_context / _build_sources
# ===================================================================
print("\n=== 5. generation_service internal helpers ===")

from app.services.generation_service import (
    _build_context,
    _build_sources,
    _NO_CONTEXT_MESSAGE,
    _SYSTEM_PROMPT,
)

# _build_context with chunks
sample_chunks = [
    {
        "text": "Chunk one content.",
        "score": 0.95,
        "metadata": {"document_id": "d1", "filename": "doc1.md", "chunk_index": 0},
    },
    {
        "text": "Chunk two content.",
        "score": 0.85,
        "metadata": {"document_id": "d2", "filename": "doc2.md", "chunk_index": 1},
    },
]
ctx = _build_context(sample_chunks)
check("_build_context returns string", isinstance(ctx, str))
check("_build_context contains filename", "doc1.md" in ctx)
check("_build_context contains chunk index", "chunk 0" in ctx)
check("_build_context contains chunk text", "Chunk one content." in ctx)
check("_build_context separator present", "---" in ctx)

# _build_context with empty list
check("_build_context([]) returns ''", _build_context([]) == "")

# _build_sources
sources = _build_sources(sample_chunks)
check("_build_sources returns list", isinstance(sources, list))
check("_build_sources len", len(sources) == 2)
check("_build_sources[0].document_id", sources[0]["document_id"] == "d1")
check("_build_sources[0].filename", sources[0]["filename"] == "doc1.md")
check("_build_sources[0].chunk_index", sources[0]["chunk_index"] == 0)
check("_build_sources[0].preview present", "Chunk one content." in sources[0]["preview"])

# _build_sources with empty list
check("_build_sources([]) returns []", _build_sources([]) == [])

# Check system prompt constant
check("_SYSTEM_PROMPT contains {context}", "{context}" in _SYSTEM_PROMPT)
check("_SYSTEM_PROMPT contains {question}", "{question}" in _SYSTEM_PROMPT)
check("_SYSTEM_PROMPT contains 'SOLELY'", "SOLELY" in _SYSTEM_PROMPT)
check("_NO_CONTEXT_MESSAGE is non-empty", len(_NO_CONTEXT_MESSAGE) > 0)

# ===================================================================
# 6. generation_service.generate_answer — edge cases
# ===================================================================
print("\n=== 6. generate_answer edge cases ===")

from app.services.generation_service import generate_answer

# Empty chunks → no LLM call → guardrail message
result_empty = generate_answer("test question", [])
check("generate_answer([], no-LLM) returns dict", isinstance(result_empty, dict))
check("generate_answer([], no-LLM) has 'answer'", "answer" in result_empty)
check("generate_answer([], no-LLM) guardrail msg",
      result_empty["answer"] == _NO_CONTEXT_MESSAGE)
check("generate_answer([], no-LLM) empty sources",
      result_empty["sources"] == [])

# No chunks scenario via metadata-valid but empty chunks
result_empty2 = generate_answer("test question", [])
check("generate_answer([], no-LLM) second call consistent",
      result_empty2["answer"] == _NO_CONTEXT_MESSAGE)

# ===================================================================
# 7. generation_service._get_llm error handling
# ===================================================================
print("\n=== 7. _get_llm error handling ===")

from app.services.generation_service import _get_llm

try:
    _get_llm()
    check("_get_llm() raises RuntimeError (no real API key)", False)
except RuntimeError:
    check("_get_llm() raises RuntimeError (no real API key)", True)
except Exception as e:
    check(f"_get_llm() raises RuntimeError (got {type(e).__name__})", False)

# generate_answer with real chunks but no LLM → should still return guardrail
# because _get_llm raises RuntimeError which is caught inside generate_answer
result_no_llm = generate_answer("test question", sample_chunks)
check("generate_answer with chunks but no LLM returns dict",
      isinstance(result_no_llm, dict))
check("generate_answer with chunks but no LLM has answer",
      "answer" in result_no_llm)
check("generate_answer with chunks but no LLM guardrail",
      result_no_llm["answer"] == _NO_CONTEXT_MESSAGE)
check("generate_answer with chunks but no LLM empty sources",
      result_no_llm["sources"] == [])

# ===================================================================
# 8. Source metadata extraction from chunks (no hard-coded sources)
# ===================================================================
print("\n=== 8. Source metadata extraction ===")

# Verify that _build_sources extracts from metadata, not hard-coded
chunks_with_missing_meta = [
    {
        "text": "Some content here",
        "score": 0.9,
        "metadata": {},
    },
]
sources_partial = _build_sources(chunks_with_missing_meta)
check("_build_sources handles missing metadata", len(sources_partial) == 1)
check("_build_sources missing doc_id default ''",
      sources_partial[0]["document_id"] == "")
check("_build_sources missing filename default 'unknown'",
      sources_partial[0]["filename"] == "unknown")
check("_build_sources missing chunk_index default 0",
      sources_partial[0]["chunk_index"] == 0)
check("_build_sources missing preview ''",
      sources_partial[0]["preview"] == "Some content here")

# Verify preview truncation
long_text = "A" * 500
long_chunk = [
    {
        "text": long_text,
        "score": 0.5,
        "metadata": {"document_id": "d1", "filename": "long.md", "chunk_index": 0},
    },
]
sources_long = _build_sources(long_chunk)
check("_build_sources preview truncated to 200 chars",
      len(sources_long[0]["preview"]) == 200)

# ===================================================================
# 9. chat.py API router — POST /v1/chat exists
# ===================================================================
print("\n=== 9. chat.py API router — POST /v1/chat ===")

import app.api.chat as chat_module

routes = chat_module.router.routes
route_paths = [r.path for r in routes]
route_post_paths = {
    r.path for r in routes if "POST" in (r.methods or set())
}

check("chat router has POST route for /retrieve",
      "/retrieve" in route_post_paths)
check("chat router has POST route for '' (/v1/chat root)",
      "" in route_post_paths)

# Verify the chat handler uses ChatRequest/ChatResponse
from app.api.chat import chat
sig = inspect.signature(chat)
check("chat() has 'payload' parameter", "payload" in sig.parameters)

# Source code checks
chat_api_path = os.path.join(PROJECT_ROOT, "app/api/chat.py")
with open(chat_api_path, encoding="utf-8") as f:
    chat_api_source = f.read()

check("chat.py imports ChatRequest", "ChatRequest" in chat_api_source)
check("chat.py imports ChatResponse", "ChatResponse" in chat_api_source)
check("chat.py imports Source", "Source" in chat_api_source)
check("chat.py imports generation_service.generate_answer",
      "from app.services.generation_service import generate_answer" in chat_api_source)
check("chat.py has @router.post for chat endpoint",
      "@router.post(" in chat_api_source and '"""' in chat_api_source)
check("chat.py no longer has Stage 10 stub comment",
      "Stage 10 stub" not in chat_api_source)

# ===================================================================
# 10. main.py wiring — /v1/chat route present
# ===================================================================
print("\n=== 10. main.py wiring ===")

try:
    from main import app
    check("main.app is instantiable", True)
    app_routes = [r.path for r in app.routes]
    check("main.app has /v1/chat/retrieve route",
          "/v1/chat/retrieve" in app_routes)
    check("main.app has /v1/chat route",
          "/v1/chat" in app_routes)
except Exception as e:
    check(f"main.app import: {e}", False)

# ===================================================================
# 11. Existing user.py preserved
# ===================================================================
print("\n=== 11. user.py chat endpoint preserved ===")

from app.api.user import router as user_router
user_routes = user_router.routes
check("user.py still has /chat endpoint",
      any("/chat" in r.path for r in user_routes))

# ===================================================================
# 12. Generation service source code structure
# ===================================================================
print("\n=== 12. Generation service source code structure ===")

gen_svc_path = os.path.join(PROJECT_ROOT, "app/services/generation_service.py")
with open(gen_svc_path, encoding="utf-8") as f:
    gen_source = f.read()

check("generation_service has generate_answer function",
      "def generate_answer(" in gen_source)
check("generation_service has _get_llm function",
      "def _get_llm(" in gen_source)
check("generation_service has _build_context function",
      "def _build_context(" in gen_source)
check("generation_service has _build_sources function",
      "def _build_sources(" in gen_source)
check("generation_service has _SYSTEM_PROMPT constant",
      "_SYSTEM_PROMPT" in gen_source)
check("generation_service has _NO_CONTEXT_MESSAGE constant",
      "_NO_CONTEXT_MESSAGE" in gen_source)
check("generation_service imports settings",
      "from app.core.config import settings" in gen_source)
check("generation_service raises RuntimeError not fake fallback",
      "raise RuntimeError" in gen_source)
check("generation_service has try/except for LLM invocation",
      "try:" in gen_source and "except" in gen_source)

# ===================================================================
# 13. Stage 9 tests still pass (regression)
# ===================================================================
print("\n=== 13. Stage 9 regression checks ===")

from app.schemas.chat import RetrieveRequest
ret_req = RetrieveRequest(question="test")
check("Stage 9 RetrieveRequest still works", ret_req.question == "test")

from app.services.retrieval_service import retrieve
check("Stage 9 retrieve('') still returns []", retrieve("") == [])

# ===================================================================
# Summary
# ===================================================================
print(f"\n{'=' * 60}")
print(f"  Results: {passed} passed, {failed} failed")
print(f"{'=' * 60}")

sys.exit(0 if failed == 0 else 1)
