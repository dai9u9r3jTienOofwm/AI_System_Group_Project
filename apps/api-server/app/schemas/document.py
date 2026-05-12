# - Định nghĩa response khi upload
# - Định nghĩa response khi list documents
# - Giúp Swagger hiển thị input/output rõ ràng

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List



class UploadDocumentRespond(BaseModel):
    document_id: str
    filename: str
    file_size: int
    status: str
    message: str
    
    
class DocumentRespond(BaseModel):
    document_id: str
    filename: str
    content_type: str | None = None
    file_size: int
    status: str
    chunk_count: int | None = None
    created_at:datetime 
    updated_at:datetime
    
    model_config = ConfigDict(from_attributes=True)
    
class DocumentListRespond(BaseModel):
    document_list: List[DocumentRespond]    