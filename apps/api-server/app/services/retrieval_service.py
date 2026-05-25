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

from app.services.qdrant_service import search_similar, extract_requested_filename, _normalise_optional_str

logger = logging.getLogger(__name__)


def retrieve(
    question: str,
    topic: str | None = None,
    uploaded_by: str | None = None,
    filename: str | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    if not question or not question.strip():
        logger.warning("retrieve() called with empty/blank question")
        return []

    try:
        requested_filename = (
            _normalise_optional_str(filename)
            or extract_requested_filename(question)
        )

        raw_results = search_similar(
            question=question,
            topic=None if requested_filename else topic,
            uploaded_by=uploaded_by,
            filename=requested_filename,
            top_k=top_k,
        )

    except Exception:
        logger.exception(
            "search_similar() failed for question=%r",
            question[:120],
        )
        return []

    normalised: list[dict[str, Any]] = []

    for res in raw_results:
        text = res.get("text", "")
        if not isinstance(text, str):
            text = str(text)

        metadata = res.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}

        score = res.get("score", 0.0)
        if not isinstance(score, (int, float)):
            try:
                score = float(score)
            except Exception:
                score = 0.0

        if text.strip():
            normalised.append(
                {
                    "text": text,
                    "score": score,
                    "metadata": metadata,
                }
            )

    logger.info(
        "retrieve() returned %d chunks filename=%s topic=%s",
        len(normalised),
        requested_filename,
        topic,
    )

    return normalised