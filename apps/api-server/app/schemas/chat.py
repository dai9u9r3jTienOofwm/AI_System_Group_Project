"""
Retrieval and generation schemas (Stage 9 — Retrieval, Stage 10 — Generation).

Pydantic models for request/response of the retrieval and chat endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class RetrieveRequest(BaseModel):
    """Request body for ``POST /v1/chat/retrieve``."""

    question: str = Field(
        ...,
        min_length=1,
        description="User query text — must be a non-empty string.",
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of top-K results to retrieve (1–20).",
    )
    topic: Optional[str] = Field(
        default=None,
        description="Topic filter - optional",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User ID - used to filter documents based on ownership",
    )


class RetrievedChunk(BaseModel):
    """A single chunk returned from the retrieval service."""

    text: str = Field(..., description="Text content of the chunk.")
    score: float = Field(..., description="Cosine similarity score (higher = more relevant).")
    metadata: dict = Field(
        default_factory=dict,
        description=(
            "Chunk metadata payload, typically containing ``document_id``, "
            "``filename``, ``chunk_index``, ``source_type``, etc."
        ),
    )


class RetrieveResponse(BaseModel):
    """Response body for ``POST /v1/chat/retrieve``."""

    chunks: list[RetrievedChunk] = Field(
        default_factory=list,
        description="List of retrieved chunks. Empty list if no results found.",
    )


# ── Stage 10 stubs (preserved for forward compatibility) ────────────────

class ChatRequest(BaseModel):
    """Request body for ``POST /v1/chat`` (Stage 10)."""

    question: str = Field(..., min_length=1, description="User query text.")
    topic: str
    top_k: int = Field(default=5, ge=1, le=20, description="Number of retrieval results to use as context.")
    user_id: Optional[str] = Field(default=None, description="User ID - for access control and filtering documents")
    document_ids: Optional[list[str]] = Field(default=None, description="Optional list of document IDs to include in context")


class Source(BaseModel):
    """A single source citation for a generated answer (Stage 10).
    
    Includes URLs to fetch full file content and chunk preview from backend.
    Frontend can use these URLs to display evidence/proof of citations.
    """

    document_id: str = Field(..., description="UUID of the source document.")
    filename: str = Field(..., description="Original filename of the source document.")
    chunk_index: int = Field(..., description="0-based chunk index within the source document.")
    preview: str = Field(..., description="Short text preview of the chunk content (max 200 chars).")
    
    # ✨ Stage 10 Citation URLs - for frontend to fetch evidence
    content_url: str = Field(
        ...,
        description="URL to fetch full file content: GET /v1/documents/{document_id}/content"
    )
    chunk_url: str = Field(
        ...,
        description="URL to fetch specific chunk: GET /v1/documents/{document_id}/chunk-preview?chunk_index={chunk_index}"
    )


class ChatResponse(BaseModel):
    """Response body for ``POST /v1/chat`` (Stage 10)."""

    answer: str = Field(..., description="Generated answer text.")
    sources: list[Source] = Field(default_factory=list, description="Source citations for the answer.")


class ChatSessionCreate(BaseModel):
    topic: str = Field(..., description="Topic of chat")
    title: Optional[str] = "Newchat"

class ChatSessionResponse(BaseModel):
    id: UUID
    title: str
    topic: str
    created_at: datetime
    
    class Config:
        from_attributes = True