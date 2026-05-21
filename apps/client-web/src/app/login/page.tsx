'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Lock, User } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!username.trim() || !password.trim()) return;

  setIsLoading(true);
  setError('');

  try {
    const values = {
      username: username.trim(),
      password: password
    };

    // 1. Gọi API đăng nhập bằng apiClient hướng sang Python Backend
    const data = await apiClient.client.post('/v1/auth/login', values) as any;

    // 2. ĐÃ SỬA: Check theo dữ liệu thực tế của Python trả về (dùng data.id thay vì token)
    if (data.id) {
      // Xác định role dựa vào cờ is_admin của Python
      const userRole = data.is_admin ? 'admin' : 'client';
      
      // Lưu vào localStorage phục vụ cho Frontend nếu cần
      localStorage.setItem('userId', data.id);
      localStorage.setItem('userRole', userRole);

      // 🔥 SỬA CHÍ MẠNG Ở ĐÂY: Tạo một chuỗi Session đơn giản (Plain Text) chứa id và role
      const sessionData = JSON.stringify({ id: data.id, role: userRole });

      // Ném thẳng vào Cookie để file proxy.ts (Server-side) có thể bóc tách ra đọc được
      // Mình set cả cookie gộp lẫn cookie lẻ cho chắc ăn, tùy thuộc vào việc proxy.ts của bạn đang gọi tên biến nào:
      document.cookie = `userSession=${encodeURIComponent(sessionData)}; path=/; max-age=86400; SameSite=Lax;`;
      document.cookie = `userId=${data.id}; path=/; max-age=86400; SameSite=Lax;`;
      document.cookie = `auth_role=${userRole}; path=/; max-age=86400; SameSite=Lax;`;
    }

    router.push('/');
    router.refresh();

  } catch (err: any) {
    // Bắt lỗi chuẩn từ FastAPI dội về (Ví dụ: "Sai mật khẩu")
    const errorMessage = err.response?.data?.detail || 'Sai tài khoản/mật khẩu hoặc máy chủ đang bảo trì.';
    setError(errorMessage);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">UET AI Assistant</h1>
          <p className="text-gray-400 text-sm mt-1">Đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Tên đăng nhập
            </label>
            <div className="relative">
              <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                autoComplete="username"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm mt-2"
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Chưa có tài khoản?{' '}
          <button
            onClick={() => router.push('/register')}
            className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
          >
            Đăng ký tại đây
          </button>
        </p>
        <p className="text-center text-xs text-gray-600 mt-2">
          UET AI System — Nhóm dự án môn học
        </p>
      </div>
    </div>
  );
}