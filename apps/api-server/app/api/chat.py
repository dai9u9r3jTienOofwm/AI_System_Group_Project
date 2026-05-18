"""
Chat API router (Stage 9 — Retrieval, Stage 10 — Generation).

Exposes:
    POST /v1/chat/retrieve  — retrieve semantically similar chunks (Stage 9)
    POST /v1/chat           — retrieve + generate answer via LLM  (Stage 10)
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    RetrieveRequest,
    RetrieveResponse,
    RetrievedChunk,
    Source,
)
from app.services.retrieval_service import retrieve
from app.services.generation_service import generate_answer

router = APIRouter()


@router.post(
    "/retrieve",
    response_model=RetrieveResponse,
    summary="Retrieve relevant chunks",
    description=(
        "Embed the user's query, search the Qdrant vector store, and return "
        "the top-K semantically similar chunks with text, score, and metadata."
    ),
)
def retrieve_chunks(payload: RetrieveRequest) -> RetrieveResponse:
    """Retrieve semantically similar chunks for the given *question*.

    Validates that ``question`` is non-empty and ``top_k`` is within 1–20,
    then delegates to :func:`retrieval_service.retrieve`.
    Returns an always-safe ``RetrieveResponse`` with ``chunks=[]`` when
    no results are found or when an error occurs.
    """
    # Pydantic ``Field(min_length=1)`` and ``Field(ge=1, le=20)`` already
    # enforce these constraints at the schema level, but we double-check
    # for defence-in-depth.
    if not payload.question or not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question must be a non-empty string.",
        )

    try:
        raw_chunks = retrieve(
            question=payload.question,
            top_k=payload.top_k,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Retrieval service failed unexpectedly.",
        )

    chunks = [
        RetrievedChunk(
            text=chunk["text"],
            score=chunk["score"],
            metadata=chunk.get("metadata", {}),
        )
        for chunk in raw_chunks
    ]

    return RetrieveResponse(chunks=chunks)


@router.post(
    "",
    response_model=ChatResponse,
    summary="Chat — retrieve + generate",
    description=(
        "Retrieve relevant chunks from Qdrant, build a prompt, and call "
        "the configured LLM to generate an answer with source citations."
    ),
)
def chat(payload: ChatRequest) -> ChatResponse:
    """Retrieve context and generate an answer via the configured LLM.

    1. Validates the request (non-empty question).
    2. Retrieves semantically similar chunks from Qdrant (delegates to
       :func:`retrieval_service.retrieve`).
    3. Passes the chunks to :func:`generation_service.generate_answer`
       which builds a context-augmented prompt and invokes the LLM.
    4. Returns the generated answer and source citations.

    If retrieval returns no chunks, the LLM is not invoked — a guardrail
    message is returned instead.
    """
    if not payload.question or not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question must be a non-empty string.",
        )

    # ------------------------------------------------------------------
    # 1 — Retrieve chunks
    # ------------------------------------------------------------------
    try:
        raw_chunks = retrieve(
            question=payload.question,
            top_k=payload.top_k,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Retrieval service failed unexpectedly.",
        )

    # ------------------------------------------------------------------
    # 2 — Generate answer from retrieved context
    # ------------------------------------------------------------------
    try:
        result = generate_answer(
            question=payload.question,
            chunks=raw_chunks,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Generation service failed unexpectedly.",
        )

    answer: str = result.get("answer", "")
    raw_sources: list[dict] = result.get("sources", [])

    # ------------------------------------------------------------------
    # 3 — Build response
    # ------------------------------------------------------------------
    sources = [
        Source(
            document_id=src.get("document_id", ""),
            filename=src.get("filename", "unknown"),
            chunk_index=src.get("chunk_index", 0),
            preview=src.get("preview", ""),
        )
        for src in raw_sources
    ]

    return ChatResponse(answer=answer, sources=sources)
