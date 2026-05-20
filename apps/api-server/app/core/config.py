# - Đọc DATABASE_URL
# - Đọc MINIO_ENDPOINT
# - Đọc MINIO_ACCESS_KEY
# - Đọc MINIO_SECRET_KEY
# - Đọc QDRANT_URL
# - Đọc REDIS_URL
# - Đọc OPENAI_API_KEY/GEMINI_API_KEY/OLLAMA_URL

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str 

    MINIO_ENDPOINT: str 
    MINIO_ACCESS_KEY: str 
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str = "rag-documents"
    MINIO_SECURE: bool = False

    QDRANT_URL: str
    QDRANT_COLLECTION: str = "technical_rag"
    QDRANT_VECTOR_SIZE: int = 1536


    REDIS_URL: str 

    LLM_PROVIDER: str = "openai"         
    LLM_MODEL: str = "gpt-4o-mini"
    
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_BASE: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()