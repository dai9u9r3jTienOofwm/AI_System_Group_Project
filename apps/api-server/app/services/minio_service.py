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

def get_client():
    return MinioService(create_minio_client())