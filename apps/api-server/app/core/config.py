# - Đọc DATABASE_URL
# - Đọc MINIO_ENDPOINT
# - Đọc MINIO_ACCESS_KEY
# - Đọc MINIO_SECRET_KEY
# - Đọc QDRANT_URL
# - Đọc REDIS_URL
# - Đọc OPENAI_API_KEY/GEMINI_API_KEY/OLLAMA_URL

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/ragdb"

    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "rag-documents"
    MINIO_SECURE: bool = False

    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_COLLECTION: str = "technical_rag"

    REDIS_URL: str = "redis://redis:6379/0"

    OPENAI_API_KEY: str | None = None
    LLM_PROVIDER: str = "openai"

    class Config:
        env_file = ".env"


settings = Settings()