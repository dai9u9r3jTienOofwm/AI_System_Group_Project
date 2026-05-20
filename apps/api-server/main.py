# - Tạo FastAPI application
# - Cấu hình CORS
# - Include các router: admin, chat, documents
# - Khai báo middleware nếu có
# - Khai báo health check đơn giản


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.workers.celery_app import app as celery_app
from app.api import chat, health, admin, documents, auth, ingest_status
from app.db.init_db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("Starting up...")
    yield

app = FastAPI(lifespan= lifespan)
# Configure CORS to allow requests from both frontends
origins = [
    "http://localhost:3000",  # client-web
    "http://localhost:3001",  # admin-dashboard
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(admin.router, prefix="/v1/admin", tags=["Admin"])
app.include_router(documents.router, prefix="/v1/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/v1/chat", tags=["Chat"])
app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])
app.include_router(ingest_status.router, prefix="/v1/ingest", tags=["Ingest Status"])
