# - Định nghĩa bảng documents trong PostgreSQL
# - Lưu metadata tài liệu
# - Không lưu file gốc
# - Không lưu vector

from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, Text
from app.db.base import Base


class Document(Base):
    
    __tablename__ = "documents"
    
    document_id = Column(String, primary_key= True, index= True)
    filename = Column(String, nullable= False)
    content_type = Column(String, nullable= True)
    file_size = Column(Integer, nullable=False)
    
    minio_bucket = Column(String,nullable=False)
    minio_object_name = Column(String, nullable=False)
    status = Column(String, nullable= False, default= "uploaded")
    chunk_count = Column(Integer, nullable= True)
    error_message = Column(Text, nullable= True)
    
    uploaded_by = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)
    
    