/**
 * API Client - admin-dashboard (Ứng dụng Quản trị)
 * Kết nối trực tiếp tới Python FastAPI Backend Server
 */
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  public client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true, // 🔥 BẮT BUỘC: Cho phép Axios đính kèm Cookie (userId, auth_role) sang cổng 8000
      headers: {
        'Content-Type': 'application/json',
      },
    });

    /**
     * Response Interceptor: Bóc tách data sạch về cho UI dashboard sử dụng
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

  /**
   * ===== QUẢN LÝ NGƯỜI DÙNG (USERS) =====
   */
  async getUsers(): Promise<any> {
    try {
      return await this.client.get('/v1/admin/user') as any;
    } catch (error) {
      console.warn('Endpoint /v1/users chưa được implement, dùng mock data');
      return [
        {
          id: '1',
          email: 'admin@example.com',
          username: 'Admin User',
          role: 'admin',
          is_active: true,
        },
      ];
    }
  }

  async createUser(userData: Record<string, unknown>): Promise<any> {
    try {
      return await this.client.post('/v1/users', userData) as any;
    } catch (error) {
      console.warn('Endpoint POST /v1/users chưa được implement');
      return {
        id: '2',
        ...userData,
      };
    }
  }

  async updateUser(userId: number, userData: Record<string, unknown>): Promise<any> {
    return this.client.put(`/v1/users/${userId}`, userData);
  }

  async deleteUser(userId: number): Promise<any> {
    return this.client.delete(`/v1/admin/users/${userId}`);
  }
}

export const apiClient = new ApiClient();