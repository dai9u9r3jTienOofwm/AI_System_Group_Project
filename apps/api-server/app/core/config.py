# - Đọc DATABASE_URL
# - Đọc MINIO_ENDPOINT
# - Đọc MINIO_ACCESS_KEY
# - Đọc MINIO_SECRET_KEY
# - Đọc QDRANT_URL
# - Đọc REDIS_URL
# - Đọc OPENAI_API_KEY/GEMINI_API_KEY/OLLAMA_URL

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str 

    MINIO_ENDPOINT: str 
    MINIO_ACCESS_KEY: str 
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str = "rag-documents"
    MINIO_SECURE: bool = False

    QDRANT_URL: str
    QDRANT_COLLECTION: str = "technical_rag"

    REDIS_URL: str 
    JWT_SECRET_KEY: str = "SecretStr"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    OPENAI_API_KEY: str | None
    LLM_PROVIDER: str = "openai"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()