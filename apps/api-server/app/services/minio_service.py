from minio import Minio
from fastapi import UploadFile
from io import BytesIO
from app.core.config import settings
from app.core.client import create_minio_client

class MinioService:
    def __init__(self, client: Minio):
        self.client = client         

    async def upload_file(self, object_name, upload_file: UploadFile):
        bucket_name = settings.MINIO_BUCKET
        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)


        file_data = await upload_file.read()
        file_length = len(file_data)


        self.client.put_object(
        bucket_name=bucket_name,
        object_name=object_name,
        data = BytesIO(file_data),
        length=file_length,
        content_type=upload_file.content_type
    )

    def download_file(self, bucket_name: str, object_name: str) -> bytes:
        """Download a file from MinIO and return its contents as raw bytes."""
        response = self.client.get_object(bucket_name, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete_file(self, bucket_name: str, object_name: str) -> None:
        """Delete an object from MinIO."""
        self.client.remove_object(bucket_name, object_name)


def get_client():
    return MinioService(create_minio_client())