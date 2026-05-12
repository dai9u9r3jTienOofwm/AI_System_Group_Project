# - Tạo FastAPI application
# - Cấu hình CORS
# - Include các router: admin, chat, documents
# - Khai báo middleware nếu có
# - Khai báo health check đơn giản


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.workers.celery_app import app as celery_app
from app.api import health, admin, documents, user
from app.db.init_db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("Starting up...")
    yield

app = FastAPI(lifespan= lifespan)

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
app.include_router(user.router, prefix="/v1/user", tags=["Chat"])
