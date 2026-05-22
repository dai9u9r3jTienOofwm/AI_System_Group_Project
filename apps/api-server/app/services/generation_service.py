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
    "You are an intelligent technical and coding assistant.\n\n"
    "Instructions:\n"
    "1. Use the provided Context below to explain general concepts, theories, and rules.\n"
    "2. If the user provides specific code snippets, examples, or data directly in their Question, "
    "you MUST analyze and evaluate that code using your own logical reasoning. Use the theoretical "
    "knowledge from the Context to support your explanation.\n"
    "3. Do NOT refuse to evaluate the user's code just because it is not explicitly present in the Context.\n"
    "4. If the question asks for specific factual knowledge that is neither in the Context nor derivable "
    "from standard coding logic, only then say \"I don't have enough information to answer this question\".\n\n"
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
    """Build a source-citation list from chunk metadata.

    Each source dict contains ``document_id``, ``filename``,
    ``chunk_index``, and ``preview`` (first 200 chars of text).

    Returns an empty list when *chunks* is empty.
    """
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
            }
        )
    return sources


# ===================================================================
# Main entry point
# ===================================================================


def generate_answer(
    question: str,
    chunks: list[dict[str, Any]],
) -> dict[str, Any]:
    """Generate an answer using retrieved context chunks.

    Parameters
    ----------
    question : str
        The user's query text (already validated as non-empty by the
        caller / Pydantic schema).
    chunks : list[dict]
        Retrieved chunks from ``retrieval_service.retrieve()``.
        Each dict must have ``text``, ``score``, ``metadata`` keys.

    Returns
    -------
    dict
        A dict with keys:

        - **answer** (str) — the generated answer text or a guardrail
          message.
        - **sources** (list[dict]) — source citations built from chunk
          metadata.  Each source dict contains ``document_id``,
          ``filename``, ``chunk_index``, ``preview``.

    Behaviour by scenario
    ---------------------
    - **No chunks**: returns the guardrail message ``_NO_CONTEXT_MESSAGE``
      and an empty sources list.  The LLM is **not** invoked.
    - **LLM unavailable**: catches ``RuntimeError`` from ``_get_llm()``
      and returns the guardrail message.  This is **not** a hard-coded
      fake answer — it transparently tells the user the system cannot
      answer.
    - **LLM invocation fails**: logs the exception and returns a generic
      error message.
    - **Success**: returns the LLM-generated answer with source citations.
    """
    # ------------------------------------------------------------------
    # Guardrail: no context → no LLM call
    # ------------------------------------------------------------------
    if not chunks:
        logger.info(
            "generate_answer() called with empty chunks — "
            "returning guardrail message (no LLM call).",
        )
        return {
            "answer": _NO_CONTEXT_MESSAGE,
            "sources": [],
        }

    # ------------------------------------------------------------------
    # Obtain LLM (may raise RuntimeError)
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # Build prompt and invoke LLM
    # ------------------------------------------------------------------
    context_str = _build_context(chunks)
    prompt = _SYSTEM_PROMPT.format(context=context_str, question=question)

    try:
        logger.debug(
            "Invoking LLM with %d context chunks (question length=%d)",
            len(chunks),
            len(question),
        )
        response = llm.invoke(prompt)
        answer: str = (
            response.content
            if hasattr(response, "content")
            else str(response)
        )
        logger.debug("LLM response received (length=%d)", len(answer))
    except Exception:
        logger.exception("LLM invocation failed unexpectedly")
        return {
            "answer": (
                "An error occurred while generating the answer. "
                "Please try again later."
            ),
            "sources": [],
        }

    # ------------------------------------------------------------------
    # Build source citations
    # ------------------------------------------------------------------
    sources = _build_sources(chunks)

    logger.info(
        "generate_answer() — answer length=%d, %d sources",
        len(answer),
        len(sources),
    )
    return {
        "answer": answer,
        "sources": sources,
    }
