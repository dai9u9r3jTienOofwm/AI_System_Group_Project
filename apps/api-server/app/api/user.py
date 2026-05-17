# - Nhận câu hỏi từ người dùng
# - Gọi retrieval_service để tìm tài liệu liên quan trong Qdrant
# - Gọi generation_service để tạo câu trả lời bằng LLM
# - Trả answer + sources
# - Có thể hỗ trợ streaming response

from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def chat():
    return {
        "answer": "Mock answer",
        "sources": []
    }
    
