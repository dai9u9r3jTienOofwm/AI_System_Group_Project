/**
 * API Client - Quản lý tất cả các yêu cầu gửi tới Backend (Python API Server)
 * 
 * Tác dụng:
 * - Tạo một "lớp trung gian" để gọi API từ Backend
 * - Tự động thêm token xác thực (Authorization header) vào mỗi request
 * - Giảm thiểu sự lặp lại code khi gọi API ở nhiều nơi
 * 
 * Cách dùng:
 * import { apiClient } from '@/lib/api-client';
 * await apiClient.getUsers();  // Lấy danh sách người dùng từ backend
 */

import axios, { AxiosInstance } from 'axios';

// Lấy URL của Backend từ biến môi trường, nếu không có thì dùng localhost:8000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Lớp ApiClient:
 * - Khởi tạo axios client một lần duy nhất
 * - Cấu hình interceptor (bộ lọc) để tự động thêm token vào header
 * - Chứa các method để gọi các endpoint khác nhau từ backend
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    // Tạo client axios với cấu hình cơ bản
    this.client = axios.create({
      baseURL: API_BASE_URL,  // Tất cả request sẽ gửi tới URL này
      headers: {
        'Content-Type': 'application/json',  // Định dạng dữ liệu là JSON
      },
    });

    /**
     * Interceptor (bộ lọc) cho request:
     * - Trước khi gửi mỗi request, hãy tự động lấy token từ localStorage
     * - Gắn token vào header với định dạng: "Authorization: Bearer <token>"
     * - Token này được backend sử dụng để xác thực người dùng
     */
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');  // Lấy token từ bộ nhớ trình duyệt
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;  // Thêm vào header
      }
      return config;  // Trả về config đã chỉnh sửa
    });
  }

  /**
   * ===== CÁC HÀM LIÊN QUAN TỚI QUẢN LÝ TÀI LIỆU (DOCUMENTS) =====
   */

  /** Upload một file tài liệu lên backend */
  async uploadDocument(file: File, metadata?: Record<string, unknown>) {
    const formData = new FormData();  // FormData dùng để gửi file (không phải JSON)
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return this.client.post('/docs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },  // Định dạng gửi file
    });
  }

  /** Xóa một tài liệu bằng ID của nó */
  async deleteDocument(docId: string) {
    return this.client.delete(`/docs/delete?doc_id=${docId}`);
  }

  /** Lấy trạng thái xử lý/ingestion của các tài liệu */
  async getIngestStatus() {
    return this.client.get('/ingest/status');
  }

  /**
   * ===== CÁC HÀM LIÊN QUAN TỚI QUẢN LÝ NGƯỜI DÙNG (USERS) =====
   */

  /** Lấy danh sách tất cả người dùng từ backend */
  async getUsers() {
    return this.client.get('/users');
  }

  /** Tạo một người dùng mới */
  async createUser(userData: Record<string, unknown>) {
    return this.client.post('/users', userData);
  }

  /** Cập nhật thông tin của một người dùng */
  async updateUser(userId: string, userData: Record<string, unknown>) {
    return this.client.put(`/users/${userId}`, userData);
  }

  /** Xóa một người dùng bằng ID */
  async deleteUser(userId: string) {
    return this.client.delete(`/users/${userId}`);
  }
}

export const apiClient = new ApiClient();