"""
Chat API router (Stage 9 — Retrieval, Stage 10 — Generation).

Exposes:
    POST /v1/chat/retrieve  — retrieve semantically similar chunks (Stage 9)
    POST /v1/chat           — retrieve + generate answer via LLM  (Stage 10)
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Cookie, Form
from sqlalchemy.orm import Session
from uuid import uuid4
import re
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
from app.api.admin import ALLOWED_EXTENSIONS, get_doc_service
from app.services.document_service import DocumentService
from app.schemas.document import UploadDocumentRespond
from app.db.session import get_db
from app.models.user import User
from app.models.chat import ChatSession
from app.models.document import Document

_NO_CONTEXT_ANSWER = (
    "I don't have enough information to answer this question."
)
_STOPWORDS = {
    "what", "is", "are", "the", "a", "an", "in", "on", "of", "to", "for",
    "and", "or", "with", "about", "explain", "output", "does", "do",
    "là", "gì", "trong", "của", "về", "hãy", "giải", "thích",
}
router = APIRouter()
def _question_terms(question: str) -> set[str]:
    words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_+#.-]*", question.lower())
    return {
        w for w in words
        if len(w) >= 3 and w not in _STOPWORDS
    }


def _filter_sources_for_display(
    question: str,
    sources: list[dict],
) -> list[dict]:
    """
    Chỉ dùng để lọc citation hiển thị.
    Không ảnh hưởng đến retrieval/generation chính.
    """
    terms = _question_terms(question)

    if not terms:
        return sources

    filtered = []

    for src in sources:
        searchable = " ".join(
            [
                str(src.get("filename", "")),
                str(src.get("preview", "")),
                str(src.get("preview_text", "")),
                str(src.get("content", "")),
            ]
        ).lower()

        if any(term in searchable for term in terms):
            filtered.append(src)

    return filtered


def _is_no_context_answer(answer: str) -> bool:
    normalized = (answer or "").strip().lower()

    return ( "i don't have enough information" in normalized)

def _validate_attached_documents(
    *,
    db: Session,
    document_ids: list[str],
    chat_topic: str | None,
    current_user_id: str,
) -> list[str]:
    """
    Validate attached documents before retrieval/generation.

    Rules:
    1. document_id must exist.
    2. document must belong to current user or admin/public.
    3. document must be completed/indexed.
    4. document.topic must match the current chat topic.

    If any rule fails, we stop before retrieval and before calling the LLM.
    """

    clean_ids = list(
        dict.fromkeys(
            str(doc_id).strip()
            for doc_id in (document_ids or [])
            if str(doc_id).strip()
        )
    )

    if not clean_ids:
        return []

    clean_chat_topic = (chat_topic or "").strip()

    if not clean_chat_topic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đoạn chat chưa có chủ đề. Vui lòng chọn topic trước khi đính kèm tài liệu.",
        )

    docs = (
        db.query(Document)
        .filter(Document.document_id.in_(clean_ids))
        .all()
    )

    found_ids = {str(doc.document_id) for doc in docs}
    missing_ids = [doc_id for doc_id in clean_ids if doc_id not in found_ids]

    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Một số tài liệu đính kèm không tồn tại hoặc đã bị xóa: "
                + ", ".join(missing_ids)
            ),
        )

    # ------------------------------------------------------------------
    # Owner check
    # ------------------------------------------------------------------
    # Hỗ trợ cả 2 kiểu lưu:
    #   uploaded_by = "1"
    #   uploaded_by = "user_1"
    # đồng thời cho phép tài liệu admin/public.
    current_user = str(current_user_id).strip()

    allowed_owners = {
        current_user,
        "admin",
    }

    if current_user.isdigit():
        allowed_owners.add(f"user_{current_user}")

    if current_user.startswith("user_"):
        allowed_owners.add(current_user.replace("user_", "", 1))

    forbidden_docs = []

    for doc in docs:
        uploaded_by = str(getattr(doc, "uploaded_by", "") or "").strip()

        if uploaded_by not in allowed_owners:
            forbidden_docs.append(doc)

    if forbidden_docs:
        names = ", ".join(
            getattr(doc, "filename", str(doc.id))
            for doc in forbidden_docs
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Bạn không có quyền sử dụng tài liệu: {names}",
        )

    # ------------------------------------------------------------------
    # Status check
    # ------------------------------------------------------------------
    # Không cho dùng file chưa xử lý xong để tránh RAG lấy context rỗng.
    invalid_status_docs = []

    for doc in docs:
        doc_status = str(getattr(doc, "status", "") or "").strip().lower()

        if doc_status not in {"completed", "indexed"}:
            invalid_status_docs.append(doc)

    if invalid_status_docs:
        names = ", ".join(
            f"{getattr(doc, 'filename', str(doc.id))}({getattr(doc, 'status', 'unknown')})"
            for doc in invalid_status_docs
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Một số tài liệu chưa sẵn sàng để truy vấn: "
                f"{names}. Vui lòng chờ ingestion hoàn tất."
            ),
        )

    # ------------------------------------------------------------------
    # Topic check
    # ------------------------------------------------------------------
    # Đây là điều kiện quan trọng:
    # File thuộc topic khác thì không được dùng trong đoạn chat hiện tại.
    wrong_topic_docs = []

    for doc in docs:
        doc_topic = str(getattr(doc, "topic", "") or "").strip()

        if doc_topic.casefold() != clean_chat_topic.casefold():
            wrong_topic_docs.append(doc)

    if wrong_topic_docs:
        details = [
            {
                "document_id": str(doc.document_id),
                "filename": getattr(doc, "filename", "unknown"),
                "document_topic": getattr(doc, "topic", None),
                "chat_topic": clean_chat_topic,
            }
            for doc in wrong_topic_docs
        ]

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": (
                    "Tài liệu đính kèm không thuộc chủ đề của đoạn chat hiện tại. "
                    "AI sẽ không trả lời bằng tài liệu sai topic. "
                    "Vui lòng chọn tài liệu đúng chủ đề hoặc tạo đoạn chat mới."
                ),
                "wrong_topic_documents": details,
            },
        )

    return clean_ids

@router.post("/upload", response_model=UploadDocumentRespond)
async def upload_file(file: UploadFile = File(...),topic: str = Form(None),chat_session_id: str = Form(None),doc_service: DocumentService = Depends(get_doc_service), userId: str = Cookie(None)):
    if not userId:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!"
        )
    
    if not file.filename:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= "Filename is required.",  
        )
    user_id = int(userId)
    
    file_extension = '.'+ str(file.filename.split('.')[-1].lower()) 

    
    if file_extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail= ".",  
        )   
    if chat_session_id:
        session = db.query(ChatSession).filter(ChatSession.id == chat_session_id).first()
        if session:
            topic = session.topic
    document_id = str(uuid4())
    object_name = f"documents/{document_id}/{file.filename}"
        
    try:
        return await doc_service.handle_upload(file=file,upload_by = str(user_id),document_id=document_id,object_name=object_name, topic=topic)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(exc)}",
        )


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
            topic=payload.topic,
            uploaded_by=payload.user_id,
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
@router.post(
    "",
    response_model=ChatResponse,
    summary="Chat — retrieve + generate",
    description=(
        "Retrieve relevant chunks from Qdrant, build a prompt, and call "
        "the configured LLM to generate an answer with source citations."
    ),
)
def chat(
    payload: ChatRequest,
    userId: str = Cookie(None),
    db: Session = Depends(get_db),
) -> ChatResponse:
    current_user_id = userId or payload.user_id

    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!",
        )

    if not payload.question or not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question must be a non-empty string.",
        )

    file_pattern = r'\b([\w-]+\.(py|txt|md|pdf|yml|yaml|c|java|asm|h|cpp))\b'
    match = re.search(file_pattern, payload.question, re.IGNORECASE)
    extracted_filename = match.group(1) if match else None

    # Nếu frontend chưa có document_ids thì dùng list rỗng.
    payload_document_ids = getattr(payload, "document_ids", []) or []

    try:
        valid_document_ids = _validate_attached_documents(
            db=db,
            document_ids=payload_document_ids,
            chat_topic=payload.topic,
            current_user_id=str(current_user_id),
        )
    except HTTPException as exc:
        # Sai file / sai topic / chưa completed thì trả text, không 500.
        return ChatResponse(
            answer=(
                exc.detail.get("message")
                if isinstance(exc.detail, dict)
                else str(exc.detail)
            ),
            sources=[],
        )

    requires_document_context = bool(valid_document_ids) or bool(extracted_filename)

    # ------------------------------------------------------------------
    # 1 — Retrieve chunks
    # ------------------------------------------------------------------
    try:
        raw_chunks = retrieve(
            question=payload.question,
            topic=payload.topic,
            uploaded_by=str(current_user_id),
            filename=extracted_filename,
            document_ids=valid_document_ids,
            top_k=payload.top_k,
        )

        current_topic = str(payload.topic or "").strip().casefold()

        # Chỉ loại chunk sai topic, không dùng keyword filter, không dùng score threshold.
        if current_topic:
            raw_chunks = [
                chunk for chunk in raw_chunks
                if str(chunk.get("metadata", {}).get("topic", "")).strip().casefold()
                == current_topic
            ]

        # Chỉ bắt buộc context khi hỏi file cụ thể hoặc attach tài liệu.
        if requires_document_context and not raw_chunks:
            return ChatResponse(
                answer="I don't have enough information to answer this question.",
                sources=[],
            )

        print(
            f"👉 Qdrant tìm được {len(raw_chunks)} chunks "
            f"cho file={extracted_filename}, topic={payload.topic}, "
            f"requires_document_context={requires_document_context}"
        )

    except Exception:
        import traceback
        traceback.print_exc()

        return ChatResponse(
            answer="Tôi không thể truy xuất tài liệu liên quan ở thời điểm hiện tại. Vui lòng thử lại sau.",
            sources=[],
        )

    # ------------------------------------------------------------------
    # 2 — Generate answer
    # ------------------------------------------------------------------
    try:
        result = generate_answer(
            question=payload.question,
            chunks=raw_chunks,
            topic=payload.topic,
            allow_general_topic_knowledge=not requires_document_context,
        )
    except Exception:
        import traceback
        traceback.print_exc()

        return ChatResponse(
            answer="Tôi chưa thể sinh câu trả lời ở thời điểm hiện tại. Vui lòng thử lại sau.",
            sources=[],
        )

    answer: str = result.get("answer", "")
    raw_sources: list[dict] = result.get("sources", [])

    if _is_no_context_answer(answer):
        return ChatResponse(answer=answer, sources=[])

    # ------------------------------------------------------------------
    # 3 — Build response sources
    # ------------------------------------------------------------------
    sources = []

    for src in raw_sources:
        try:
            document_id = str(src.get("document_id") or "")
            filename = str(src.get("filename") or "unknown")

            try:
                chunk_index = int(src.get("chunk_index") or 0)
            except (TypeError, ValueError):
                chunk_index = 0

            preview = (
                src.get("preview")
                or src.get("preview_text")
                or src.get("content")
                or ""
            )

            sources.append(
                Source(
                    document_id=document_id,
                    filename=filename,
                    chunk_index=chunk_index,
                    preview=preview,
                    content_url=src.get(
                        "content_url",
                        f"/v1/documents/{document_id}/content",
                    ),
                    chunk_url=src.get(
                        "chunk_url",
                        f"/v1/documents/{document_id}/chunk-preview?chunk_index={chunk_index}",
                    ),
                )
            )
        except Exception:
            import traceback
            traceback.print_exc()
            continue

    return ChatResponse(answer=answer, sources=sources)