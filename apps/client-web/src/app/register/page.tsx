'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Lock, User, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function RegisterPage() {
  // 1. Tách riêng thành 3 trạng thái cho 3 ô nhập liệu
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Kiểm tra xem người dùng đã nhập đủ cả 3 trường chưa
    if (!username.trim() || !email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // 2. Đóng gói đầy đủ cả 3 tham số gửi sang Python Backend
      const values = { 
        username: username.trim(),
        email: email.trim(), 
        password: password 
      };

      // Gọi API đăng ký lên cổng /v1/auth/register của FastAPI
      const data = await apiClient.client.post('/v1/auth/register', values) as any;

      if (data.status === 'success') {
        alert('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
        router.push('/login');
      }

    } catch (err: any) {
      // Bắt lỗi 422 hoặc lỗi trùng tài khoản từ FastAPI trả về
      const errorMessage = err.response?.data?.detail || 'Lỗi hệ thống! Vui lòng thử lại sau.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-[448px] min-w-[320px] p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">UET AI Assistant</h1>
          <p className="text-gray-400 text-sm mt-1">Tạo tài khoản mới</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CỘT 1: USERNAME */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Tên đăng nhập (Username)
            </label>
            <div className="relative">
              <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: tien_uet"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* CỘT 2: EMAIL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="username@example.com"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* CỘT 3: PASSWORD */}
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
                placeholder="Nhập mật khẩu bảo mật"
                autoComplete="new-password"
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
            disabled={isLoading || !username.trim() || !email.trim() || !password.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm mt-4"
          >
            {isLoading ? 'Đang tạo tài khoản...' : 'Xác nhận Đăng ký'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Đã có tài khoản?{' '}
            <button 
              onClick={() => router.push('/login')} 
              className="text-blue-500 hover:text-blue-400 font-medium transition-colors"
            >
              Đăng nhập tại đây
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          UET AI System — Nhóm dự án môn học
        </p>
      </div>
    </div>
  );
}