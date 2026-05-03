from minio import Minio
from fastapi import UploadFile

async def upload(client: Minio, bucket_name, upload_file: UploadFile):
    file_data = await upload_file.read()
    file_length = len(file_data)
    
    upload_file.file.seek(0)
    
    client.put_object(
        bucket_name=bucket_name,
        object_name=upload_file.filename,
        data = file_data, #io.BytesIO(file_data) ?
        length=file_length,
        content_type=upload_file.content_type
    )