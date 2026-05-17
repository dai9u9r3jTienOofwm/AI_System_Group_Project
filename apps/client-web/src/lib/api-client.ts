/**
 * API Client - client-web (Ứng dụng Người dùng)
 * Kết nối trực tiếp tới Python FastAPI Backend Server
 */
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  public client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true, // 🔥 BẮT BUỘC: Đồng bộ cơ chế gửi kèm Cookie nhận diện Session sang Python
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    /**
     * Response Interceptor: Bóc tách dữ liệu sạch về cho UI ứng dụng người dùng
     */
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          localStorage.removeItem('userId');
          localStorage.removeItem('userRole');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async login(credentials: Record<string, unknown>): Promise<any> {
    return this.client.post('/v1/auth/login', credentials);
  }

  /**
   * ===== QUẢN LÝ TÀI LIỆU (DOCUMENTS) =====
   * Giữ lại phần này phục vụ cho việc người dùng tự upload/xóa và xem trạng thái tài liệu RAG của riêng họ
   */
  async uploadDocument(file: File, metadata?: Record<string, unknown>): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return this.client.post('/v1/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async deleteDocument(docId: string): Promise<any> {
    return this.client.delete(`/v1/documents/${docId}`);
  }

  async getIngestStatus(): Promise<any> {
    return this.client.get('/v1/ingest/status');
  }
}

export const apiClient = new ApiClient();