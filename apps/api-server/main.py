# - Tạo FastAPI application
# - Cấu hình CORS
# - Include các router: admin, chat, documents
# - Khai báo middleware nếu có
# - Khai báo health check đơn giản


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, admin, documents, chat

app = FastAPI(
    title="Technical RAG API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(admin.router, prefix="/v1/admin", tags=["Admin"])
app.include_router(documents.router, prefix="/v1/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/v1/user", tags=["Chat"])