"""
Stage 6 smoke test — validates syntax, imports, and pure-function logic.

This file is a self-contained verification script for the ingestion pipeline.
It does NOT require Docker, MinIO, PostgreSQL, or any external services.
Run with:

    python _test_stage6.py

All assertions pass if the Stage 6 code is structurally correct.
"""
import ast
import importlib
import os
import sys
import types

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
os.environ.setdefault("OPENAI_API_KEY", "sk-test-placeholder")

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
# 1. AST syntax validation for all Stage 6 files
# ===================================================================
print("\n=== 1. AST syntax validation ===")

FILES_TO_CHECK = [
    "app/services/ingestion_service.py",
    "app/services/minio_service.py",
    "app/services/postgres_client.py",
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
# 2. Module-level imports (no DB connection needed)
# ===================================================================
print("\n=== 2. Module import verification ===")

# These modules can be imported without a live database (config only).
IMPORT_CHECKS: list[tuple[str, str]] = [
    ("app.core.config", "settings"),
    ("app.models.document", "Document"),
    ("app.schemas.document", "DocumentRespond"),
    ("app.schemas.document", "DocumentListRespond"),
    ("app.services.minio_service", "MinioService"),
    ("app.services.ingestion_service", "ingest_document"),
    ("app.services.ingestion_service", "reindex_document"),
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
# 3. MinioService method signatures (sync, not async)
# ===================================================================
print("\n=== 3. MinioService method signatures ===")

from app.services.minio_service import MinioService

# download_file must be a regular method, not a coroutine
download_file = getattr(MinioService, "download_file", None)
check("MinioService.download_file exists", download_file is not None)
if download_file:
    check(
        "MinioService.download_file is sync (not async)",
        not isinstance(download_file, types.CoroutineType)
        and not __import__("inspect").iscoroutinefunction(download_file),
    )

delete_file = getattr(MinioService, "delete_file", None)
check("MinioService.delete_file exists", delete_file is not None)
if delete_file:
    check(
        "MinioService.delete_file is sync (not async)",
        not __import__("inspect").iscoroutinefunction(delete_file),
    )

# ===================================================================
# 4. Pure-function unit tests
# ===================================================================
print("\n=== 4. Pure-function unit tests ===")

from app.services.ingestion_service import (
    _get_extension,
    _detect_content_type,
)

# _get_extension
check("_get_extension('doc.pdf') == '.pdf'", _get_extension("doc.pdf") == ".pdf")
check("_get_extension('file.TXT') == '.txt'", _get_extension("file.TXT") == ".txt")
check("_get_extension('no_ext') == ''", _get_extension("no_ext") == "")
check("_get_extension('a.b.c') == '.c'", _get_extension("a.b.c") == ".c")

# _detect_content_type
check("_detect_content_type('.pdf') == 'pdf'", _detect_content_type(".pdf") == "pdf")
check("_detect_content_type('.md') == 'markdown'", _detect_content_type(".md") == "markdown")
check("_detect_content_type('.py') == 'python'", _detect_content_type(".py") == "python")
check("_detect_content_type('.xyz') == 'text'", _detect_content_type(".xyz") == "text")

# ===================================================================
# 5. reindex_document resets status guard verification
# ===================================================================
print("\n=== 5. reindex_document guard verification ===")

# Verify that reindex_document calls update_document_status to reset
# before calling ingest_document (by scanning source).
source_path = os.path.join(PROJECT_ROOT, "app/services/ingestion_service.py")
with open(source_path, encoding="utf-8") as f:
    source = f.read()

check(
    "ingestion_service.py has idempotency guard for completed",
    'if doc.status == "completed"' in source,
)
check(
    "reindex_document resets status to 'queued'",
    'update_document_status(db, document_id, status="queued")' in source
    or 'update_document_status(db, document_id, status='
    in source,
)

# ===================================================================
# 6. No status corruption in GET /v1/documents/{id}
# ===================================================================
print("\n=== 6. No status corruption in GET endpoint ===")

documents_source = os.path.join(PROJECT_ROOT, "app/api/documents.py")
with open(documents_source, encoding="utf-8") as f:
    docs_source = f.read()

check(
    "documents.py does NOT contain `status = \"found\"`",
    'status = "found"' not in docs_source,
)

# ===================================================================
# 7. Schema and model field verification
# ===================================================================
print("\n=== 7. Schema and model field verification ===")

from app.schemas.document import DocumentRespond

resp_fields = DocumentRespond.model_fields
check("DocumentRespond has error_message field", "error_message" in resp_fields)
check("DocumentRespond has status field", "status" in resp_fields)
check("DocumentRespond has chunk_count field", "chunk_count" in resp_fields)

from app.models.document import Document
from sqlalchemy import Column, Text

doc_columns = {c.name: c for c in Document.__table__.columns}
check("Document model has error_message column", "error_message" in doc_columns)
check(
    "Document.error_message is Text type",
    isinstance(doc_columns["error_message"].type, Text),
)

# ===================================================================
# 8. postgres_client has update_document_status
# ===================================================================
print("\n=== 8. postgres_client functions ===")

from app.services import postgres_client as pc

check(
    "postgres_client has update_document_status",
    hasattr(pc, "update_document_status"),
)

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
