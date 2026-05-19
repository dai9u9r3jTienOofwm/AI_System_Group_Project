"""
Retrieval service (Stage 9).

Provides a clean business-logic layer between the API endpoint and the
Qdrant vector-store.  Responsibilities:

- Accept a validated query string and ``top_k`` parameter.
- Delegate to ``qdrant_service.search_similar()``.
- Normalise per-chunk fields (text, score, metadata, source).
- Return an always-safe response (empty list on no results or errors).

This service does **not** call any LLM — generation is handled in Stage 10.
"""

import logging
from typing import Any

from app.services.qdrant_service import search_similar

logger = logging.getLogger(__name__)


def retrieve(
    question: str,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Retrieve semantically similar chunks from Qdrant.

    Parameters
    ----------
    question : str
        The user's query (already validated as non-empty by the caller /
        Pydantic schema).
    top_k : int
        Number of results to return (clamped 1–20).

    Returns
    -------
    list[dict[str, Any]]
        A list of normalised chunk dicts with keys ``text``, ``score``,
        ``metadata``.  Returns an empty list when no results are found or
        when an error occurs inside the Qdrant call.
    """
    if not question or not question.strip():
        logger.warning("retrieve() called with empty/blank question — returning []")
        return []

    try:
        raw_results: list[dict[str, Any]] = search_similar(
            question=question,
            top_k=top_k,
        )
    except Exception:
        logger.exception(
            "search_similar() raised an unexpected error for question=%r",
            question[:120],
        )
        return []

    # ------------------------------------------------------------------
    # Normalise each result — ensure text/score/metadata keys exist even
    # if Qdrant returns a malformed payload.
    # ------------------------------------------------------------------
    normalised: list[dict[str, Any]] = []
    for idx, res in enumerate(raw_results):
        text: str = res.get("text", "")
        if not isinstance(text, str):
            text = str(text)

        score: float = res.get("score", 0.0)
        if not isinstance(score, (int, float)):
            try:
                score = float(score)
            except (TypeError, ValueError):
                score = 0.0

        metadata: dict = res.get("metadata", {})
        if not isinstance(metadata, dict):
            try:
                metadata = dict(metadata) if metadata else {}
            except (TypeError, ValueError):
                metadata = {}

        normalised.append(
            {
                "text": text,
                "score": score,
                "metadata": metadata,
            }
        )

    logger.debug(
        "retrieve() returned %d normalised chunks (top_k=%d)",
        len(normalised),
        top_k,
    )
    return normalised
