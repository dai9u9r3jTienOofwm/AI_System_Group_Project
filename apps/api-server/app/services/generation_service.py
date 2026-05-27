"""
Generation service (Stage 10 — RAG generation with LangChain).

Provides RAG-based answer generation using retrieved context chunks from the
retrieval service and a configurable LLM provider.

Responsibilities
----------------
- Build a context-augmented prompt from retrieved chunks.
- Invoke the configured LLM (OpenAI / local-fallback error) to generate answers.
- Extract source citations from chunk metadata (no hard-coded sources).
- Return a safe guardrail message when no context is available or when the
  LLM is unreachable.

This service intentionally avoids hard-coded fake answers — if no real LLM is
available it raises a clear ``RuntimeError`` so operators know the system
isn't fully configured.
"""

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Constants
# ------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are an intelligent technical and coding assistant working inside a topic-restricted system.\n\n"
    "Current chat topic:\n"
    "{topic}\n\n"
    "Instructions:\n"
    "1. Answer questions that belong to the Current chat topic.\n"
    "2. Use the provided Context below to explain general concepts, theories, rules, and document-specific details when relevant.\n"
    "3. If the user provides specific code snippets, examples, filenames, or data directly in their Question, "
    "you MUST analyze and evaluate them using your own logical reasoning. Use the theoretical knowledge from the Context when it helps.\n"
    "4. Do NOT refuse to evaluate code or explain a programming concept just because the exact answer is not explicitly present in the Context.\n"
    "5. If the question clearly belongs to a different topic than the Current chat topic, say exactly: "
    "\"I don't have enough information to answer this question.\"\n"
    "6. If the question asks for specific factual knowledge that is neither in the Context nor derivable "
    "from standard technical/coding logic within the Current chat topic, only then say: "
    "\"I don't have enough information to answer this question.\"\n\n"
    "When you use information from the Context, cite the source document filename and chunk index.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}\n\n"
    "Answer:"
)
_NO_CONTEXT_MESSAGE = (
    "I don't have enough information to answer this question."
)

_MAX_PREVIEW_CHARS = 200


# ===================================================================
# LLM provider abstraction
# ===================================================================


def _get_llm():
    provider = settings.LLM_PROVIDER

    if provider == "deepseek":
        api_key = settings.OPENAI_API_KEY
        api_base = settings.OPENAI_API_BASE

        if api_key and isinstance(api_key, str) and api_key.strip() not in ("", "None"):
            try:
                from langchain_openai import ChatOpenAI

                logger.info(
                    "Using ChatOpenAI model=%s via DeepSeek API",
                    settings.LLM_MODEL,
                )

                return ChatOpenAI(
                    openai_api_key=api_key,
                    openai_api_base=api_base,
                    model=settings.LLM_MODEL,
                    temperature=0.0,
                )

            except Exception as exc:
                logger.warning("Failed to initialise ChatOpenAI DeepSeek: %s", exc)
                raise RuntimeError(
                    f"LLM provider '{provider}' failed to initialise: {exc}"
                ) from exc

        raise RuntimeError(
            "LLM_PROVIDER='deepseek' but OPENAI_API_KEY is not set."
        )

    raise RuntimeError(
        f"Unsupported LLM_PROVIDER: '{provider}'. Supported: 'deepseek'."
    )


# ===================================================================
# Context and source builders
# ===================================================================


def _build_context(chunks: list[dict[str, Any]]) -> str:
    """Build a formatted context string from retrieved chunks.

    Each chunk is prefixed with its source location
    (``[Source: <filename>, chunk <N>]``) so the LLM can attribute
    information.
    """
    context_parts: list[str] = []
    for i, chunk in enumerate(chunks):
        text = chunk.get("text", "")
        metadata = chunk.get("metadata", {})
        filename = metadata.get("filename", "unknown")
        chunk_index = metadata.get("chunk_index", i)
        context_parts.append(
            f"[Source: {filename}, chunk {chunk_index}]\n{text}\n",
        )
    return "\n---\n".join(context_parts)


def _build_sources(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    for chunk in chunks:
        metadata = chunk.get("metadata", {})
        document_id = metadata.get("document_id", "")
        filename = metadata.get("filename", "unknown")
        chunk_index = metadata.get("chunk_index", 0)
        text = chunk.get("text", "")
        preview = text[:_MAX_PREVIEW_CHARS] if text else ""

        sources.append(
            {
                "document_id": document_id,
                "filename": filename,
                "chunk_index": chunk_index,
                "preview": preview,
                # 🌟 Add these URLs back
                "content_url": f"/v1/documents/{document_id}/content",
                "chunk_url": f"/v1/documents/{document_id}/chunk-preview?chunk_index={chunk_index}",
            }
        )
    return sources


# ===================================================================
# Main entry point
# ===================================================================


def generate_answer(
    question: str,
    chunks: list[dict[str, Any]],
    topic: str | None = None,
    allow_general_topic_knowledge: bool = False,
) -> dict[str, Any]:
    """
    Generate an answer using retrieved context chunks.

    Behaviour:
    - If chunks exist: use them as context and answer normally.
    - If chunks are empty but allow_general_topic_knowledge=True:
      still call LLM so it can answer general questions inside the current topic.
    - If chunks are empty and allow_general_topic_knowledge=False:
      return no-context. This is for file-specific/document-specific questions.
    """

    if not chunks and not allow_general_topic_knowledge:
        logger.info(
            "generate_answer() called with empty chunks and general knowledge disabled."
        )
        return {
            "answer": _NO_CONTEXT_MESSAGE,
            "sources": [],
        }

    try:
        llm = _get_llm()
    except RuntimeError:
        logger.warning(
            "generate_answer() — no LLM available (%s)",
            settings.LLM_PROVIDER,
        )
        return {
            "answer": _NO_CONTEXT_MESSAGE,
            "sources": [],
        }

    context_str = (
        _build_context(chunks)
        if chunks
        else "No retrieved context is available for this question."
    )

    prompt = _SYSTEM_PROMPT.format(
        context=context_str,
        question=question,
        topic=topic or "Unknown",
    )

    try:
        logger.debug(
            "Invoking LLM with %d context chunks, topic=%r, allow_general_topic_knowledge=%s",
            len(chunks),
            topic,
            allow_general_topic_knowledge,
        )

        response = llm.invoke(prompt)

        answer: str = (
            response.content
            if hasattr(response, "content")
            else str(response)
        )

        answer = (answer or "").strip()

        if not answer:
            return {
                "answer": _NO_CONTEXT_MESSAGE,
                "sources": [],
            }

    except Exception:
        logger.exception("LLM invocation failed unexpectedly")
        return {
            "answer": (
                "An error occurred while generating the answer. "
                "Please try again later."
            ),
            "sources": [],
        }

    # Nếu LLM từ chối thì không gắn citation rác.
    normalized = answer.lower()
    if "i don't have enough information" in normalized:
        return {
            "answer": _NO_CONTEXT_MESSAGE,
            "sources": [],
        }

    return {
        "answer": answer,
        "sources": _build_sources(chunks) if chunks else [],
    }