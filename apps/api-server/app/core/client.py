from minio import Minio
from app.core.config import settings


def create_minio_client():
    return Minio(
    endpoint= settings.MINIO_ENDPOINT,
    access_key= settings.MINIO_ACCESS_KEY,
    secret_key= settings.MINIO_SECRET_KEY,
    secure= settings.MINIO_SECURE)