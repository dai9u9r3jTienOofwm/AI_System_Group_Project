import axios from 'axios';

class ApiClient {
  private async get(endpoint: string) {
    return axios.get(`/api/proxy?endpoint=${encodeURIComponent(endpoint)}`);
  }

  private async request(method: string, endpoint: string, data?: unknown) {
    return axios.post('/api/proxy', { endpoint, data, method });
  }

  async uploadDocument(file: File, metadata?: Record<string, unknown>) {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) formData.append('metadata', JSON.stringify(metadata));
    return axios.post('/api/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  async deleteDocument(docId: string) {
    return this.request('DELETE', `/docs/delete?doc_id=${docId}`);
  }

  async getIngestStatus() {
    return this.get('/ingest/status');
  }

  async getUsers() {
    return this.get('/users');
  }

  async createUser(userData: Record<string, unknown>) {
    return this.request('POST', '/users', userData);
  }

  async updateUser(userId: string, userData: Record<string, unknown>) {
    return this.request('PUT', `/users/${userId}`, userData);
  }

  async deleteUser(userId: string) {
    return this.request('DELETE', `/users/${userId}`);
  }
}

export const apiClient = new ApiClient();
