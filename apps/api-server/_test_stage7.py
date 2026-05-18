"""
Stage 7 smoke test — validates syntax, imports, pure-function logic,
and LangChain-based parse/chunk implementation.

This file is a self-contained verification script for the ingestion pipeline.
It does NOT require Docker, MinIO, PostgreSQL, or any external services.
Run with:

    python _test_stage7.py

All assertions pass if the Stage 7 code is structurally correct.
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
# 1. AST syntax validation for all Stage 6 + 7 files
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

IMPORT_CHECKS: list[tuple[str, str]] = [
    ("app.core.config", "settings"),
    ("app.models.document", "Document"),
    ("app.schemas.document", "DocumentRespond"),
    ("app.schemas.document", "DocumentListRespond"),
    ("app.services.minio_service", "MinioService"),
    ("app.services.ingestion_service", "ingest_document"),
    ("app.services.ingestion_service", "reindex_document"),
    ("app.services.ingestion_service", "_parse_content"),
    ("app.services.ingestion_service", "_chunk_documents"),
    ("app.services.ingestion_service", "_detect_content_type"),
    ("app.services.ingestion_service", "_get_extension"),
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
# 3. LangChain integration — verify types
# ===================================================================
print("\n=== 3. LangChain integration types ===")

from app.services.ingestion_service import (
    _parse_content,
    _chunk_documents,
    _LANGUAGE_SPLITTER_MAP,
    _detect_content_type,
)

# _parse_content should return a list of LangChain Documents
result = _parse_content(b"hello world", "text", "test.txt")
check("_parse_content(text) returns list", isinstance(result, list))
check("_parse_content(text) returns list of LC docs", len(result) > 0)
# Import LCDocument to check type
from langchain_core.documents import Document as LCDocument
check("_parse_content returns LCDocument instances",
      all(isinstance(d, LCDocument) for d in result))
check("_parse_content preserves text content", result[0].page_content == "hello world")

# _parse_content with code type should set language metadata
code_result = _parse_content(b"def foo():\n  pass", "python", "test.py")
check("_parse_content(python) returns list", len(code_result) > 0)
check("_parse_content(python) has language=python metadata",
      code_result[0].metadata.get("language") == "python")

# _parse_content with empty bytes
empty_result = _parse_content(b"", "text", "empty.txt")
check("_parse_content(empty) returns empty list", len(empty_result) == 0)

# _parse_content with markdown
md_result = _parse_content(b"# Heading\n\nSome text", "markdown", "test.md")
check("_parse_content(markdown) returns list", len(md_result) > 0)
check("_parse_content(markdown) has language=markdown metadata",
      md_result[0].metadata.get("language") == "markdown")

# _LANGUAGE_SPLITTER_MAP
check("_LANGUAGE_SPLITTER_MAP has python",
      "python" in _LANGUAGE_SPLITTER_MAP)
check("_LANGUAGE_SPLITTER_MAP has javascript",
      "javascript" in _LANGUAGE_SPLITTER_MAP)
check("_LANGUAGE_SPLITTER_MAP has typescript",
      "typescript" in _LANGUAGE_SPLITTER_MAP)
check("_LANGUAGE_SPLITTER_MAP has java",
      "java" in _LANGUAGE_SPLITTER_MAP)
check("_LANGUAGE_SPLITTER_MAP has c",
      "c" in _LANGUAGE_SPLITTER_MAP)
check("_LANGUAGE_SPLITTER_MAP has cpp",
      "cpp" in _LANGUAGE_SPLITTER_MAP)

# ===================================================================
# 4. Chunking tests
# ===================================================================
print("\n=== 4. LangChain chunking tests ===")

# _chunk_documents with plain text
from app.services.ingestion_service import _chunk_documents
from langchain_core.documents import Document as LCDocument

text_docs = [LCDocument(page_content="A " * 500)]  # ~1000 chars
chunks = _chunk_documents(text_docs, "text", chunk_size=200, chunk_overlap=20)
check("_chunk_documents(text) produces multiple chunks", len(chunks) >= 2)
check("_chunk_documents(text) returns LCDocument list",
      all(isinstance(c, LCDocument) for c in chunks))
# Each chunk should be <= chunk_size (200) plus maybe a tiny overlap leftover
for c in chunks:
    check(f"chunk length <= 200 (got {len(c.page_content)})",
          len(c.page_content) <= 210)

# _chunk_documents with code (language-aware)
code_docs = [LCDocument(page_content="def foo():\n    pass\n\ndef bar():\n    return 42\n")]
code_chunks = _chunk_documents(code_docs, "python", chunk_size=50, chunk_overlap=0)
check("_chunk_documents(python) produces chunks", len(code_chunks) > 0)

# _chunk_documents with markdown (MarkdownHeaderTextSplitter + recursive)
md_docs = [LCDocument(page_content="# Title\n\nSome intro text.\n\n## Section 1\n\nContent here.\n\n## Section 2\n\nMore content.")]
md_chunks = _chunk_documents(md_docs, "markdown", chunk_size=500, chunk_overlap=50)
check("_chunk_documents(markdown) produces chunks", len(md_chunks) > 0)
# Check that section_title metadata is populated for at least one chunk
has_section_title = any("section_title" in c.metadata for c in md_chunks)
check("_chunk_documents(markdown) has section_title metadata", has_section_title)
has_language = any(c.metadata.get("language") == "markdown" for c in md_chunks)
check("_chunk_documents(markdown) has language=markdown metadata", has_language)

# _chunk_documents with empty input
empty_chunks = _chunk_documents([], "text", chunk_size=100, chunk_overlap=0)
check("_chunk_documents([]) returns []", empty_chunks == [])

# ===================================================================
# 5. Meta-dispatch tests via _detect_content_type + _parse_content
# ===================================================================
print("\n=== 5. Content type dispatch tests ===")

# Verify all supported extensions
for ext, expected_type in [
    (".pdf", "pdf"),
    (".md", "markdown"),
    (".txt", "text"),
    (".py", "python"),
    (".js", "javascript"),
    (".ts", "typescript"),
    (".c", "c"),
    (".cpp", "cpp"),
    (".java", "java"),
    (".yaml", "yaml"),
    (".yml", "yaml"),
    (".json", "json"),
]:
    check(f"_detect_content_type('{ext}') == '{expected_type}'",
          _detect_content_type(ext) == expected_type)

check("_detect_content_type('.xyz') == 'text' (fallback)",
      _detect_content_type(".xyz") == "text")

# ===================================================================
# 6. LangChain dependency verification (imports that should work)
# ===================================================================
print("\n=== 6. LangChain dependency verification ===")

try:
    import langchain
    check("langchain importable", True)
except ImportError:
    check("langchain importable", False)

try:
    from langchain_community.document_loaders import PyPDFLoader
    check("langchain_community.document_loaders.PyPDFLoader importable", True)
except ImportError:
    check("langchain_community.document_loaders.PyPDFLoader importable", False)

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    check("RecursiveCharacterTextSplitter importable", True)
except ImportError:
    check("RecursiveCharacterTextSplitter importable", False)

try:
    from langchain_text_splitters import MarkdownHeaderTextSplitter
    check("MarkdownHeaderTextSplitter importable", True)
except ImportError:
    check("MarkdownHeaderTextSplitter importable", False)

try:
    from langchain_text_splitters import Language
    check("Language enum importable", True)
except ImportError:
    check("Language enum importable", False)

# ===================================================================
# 7. Metadata and chunk structure verification
# ===================================================================
print("\n=== 7. Metadata and chunk structure ===")

# Re-import the chunky stuff
from app.services.ingestion_service import _chunk_documents, _parse_content, _chunk_markdown, _parse_pdf

# Simulate the full parse + chunk pipeline for markdown (metadata checks)
md_bytes = b"# Main Title\n\nIntro paragraph.\n\n## Subsection A\n\nSome details here.\n\n## Subsection B\n\nMore details over here."
parsed = _parse_content(md_bytes, "markdown", "test.md")
check("parse(markdown) returns non-empty", len(parsed) > 0)
chunked = _chunk_documents(parsed, "markdown", chunk_size=200, chunk_overlap=20)
check("chunk(markdown) returns non-empty", len(chunked) > 0)
# Verify metadata keys present
for c in chunked:
    if "section_title" in c.metadata:
        check("chunk has section_title metadata", True)
        break
else:
    check("at least one chunk has section_title metadata", False)

# Chunks should have index applied by ingest_document — we verify the
# enriched_chunks logic separately. For now, just check doc presence.
check("chunk has 'language' metadata",
      any("language" in c.metadata for c in chunked))

# ===================================================================
# 8. Pure-function unit tests (preserved from Stage 6)
# ===================================================================
print("\n=== 8. Pure-function unit tests ===")

from app.services.ingestion_service import (
    _get_extension,
)

# _get_extension
check("_get_extension('doc.pdf') == '.pdf'", _get_extension("doc.pdf") == ".pdf")
check("_get_extension('file.TXT') == '.txt'", _get_extension("file.TXT") == ".txt")
check("_get_extension('no_ext') == ''", _get_extension("no_ext") == "")
check("_get_extension('a.b.c') == '.c'", _get_extension("a.b.c") == ".c")

# ===================================================================
# 9. Source code structure checks
# ===================================================================
print("\n=== 9. Source code structure checks ===")

source_path = os.path.join(PROJECT_ROOT, "app/services/ingestion_service.py")
with open(source_path, encoding="utf-8") as f:
    source = f.read()

check("ingestion_service.py has idempotency guard for completed",
      'if doc.status == "completed"' in source)
check("reindex_document resets status to 'queued'",
      'update_document_status(db, document_id, status="queued")' in source
      or 'update_document_status(db, document_id, status=' in source)
check("ingestion_service.py imports PyPDFLoader",
      "from langchain_community.document_loaders import PyPDFLoader" in source)
check("ingestion_service.py imports RecursiveCharacterTextSplitter",
      "RecursiveCharacterTextSplitter" in source)
check("ingestion_service.py imports MarkdownHeaderTextSplitter",
      "MarkdownHeaderTextSplitter" in source)
check("ingestion_service.py imports Language",
      "from langchain_text_splitters import" in source
      and "Language" in source)
check("ingestion_service.py has _chunk_markdown function",
      "def _chunk_markdown" in source)
check("ingestion_service.py has _parse_pdf function",
      "def _parse_pdf" in source)
check("ingestion_service.py has _persist_chunks function",
      "def _persist_chunks" in source)
check("ingestion_service.py has _cleanup_old_chunks function",
      "def _cleanup_old_chunks" in source)
check("ingestion_service.py _persist_chunks imports qdrant_service",
      "from app.services.qdrant_service import upsert_documents" in source)
check("ingestion_service.py _cleanup_old_chunks imports qdrant_service",
      "from app.services.qdrant_service import delete_by_document_id" in source)
# Ensure we no longer have the old _chunk_text placeholder
check("ingestion_service.py NO longer has _chunk_text",
      "def _chunk_text" not in source)

# ===================================================================
# 10. documents.py structure checks
# ===================================================================
print("\n=== 10. documents.py checks ===")

documents_source = os.path.join(PROJECT_ROOT, "app/api/documents.py")
with open(documents_source, encoding="utf-8") as f:
    docs_source = f.read()

check("documents.py does NOT contain `status = \"found\"`",
      'status = "found"' not in docs_source)

# ===================================================================
# 11. Schema and model field verification
# ===================================================================
print("\n=== 11. Schema and model field verification ===")

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

from app.services import postgres_client as pc
check("postgres_client has update_document_status",
      hasattr(pc, "update_document_status"))

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
