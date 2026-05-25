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
    <div className="flex-1 min-h-screen bg-background flex items-center justify-center p-gutter md:p-margin-desktop w-full">
      <main className="w-full max-w-[450px]">
        <div className="bg-[#181818] rounded-xl p-xl shadow-dialog flex flex-col items-center border border-[#282828]">
          <div className="mb-lg flex flex-col items-center">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-md border border-[#282828]">
              <span className="material-symbols-outlined text-4xl text-text-emphasis" style={{ fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
            </div>
            <h1 className="font-section-title text-section-title text-text-emphasis text-center mb-xs">Đăng nhập vào UET AI</h1>
            <p className="font-body-base text-body-base text-text-secondary text-center">Đăng nhập để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-lg">
            <div className="flex flex-col gap-sm">
              <label className="font-body-bold text-body-bold text-text-emphasis" htmlFor="username">Tài khoản</label>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
                  person
                </span>
                <input 
                  className="w-full bg-[#1f1f1f] text-text-emphasis placeholder-text-secondary rounded-full py-3 pl-12 pr-4 shadow-inset-input focus:outline-none focus:ring-1 focus:ring-primary-container transition-all" 
                  id="username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập" 
                  autoComplete="username"
                  type="text"
                />
              </div>
            </div>

            <div className="flex flex-col gap-sm">
              <label className="font-body-bold text-body-bold text-text-emphasis" htmlFor="password">Mật khẩu</label>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
                  lock
                </span>
                <input 
                  className="w-full bg-[#1f1f1f] text-text-emphasis placeholder-text-secondary rounded-full py-3 pl-12 pr-4 shadow-inset-input focus:outline-none focus:ring-1 focus:ring-primary-container transition-all" 
                  id="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu" 
                  autoComplete="current-password"
                  type="password"
                />
              </div>
            </div>

            {error && (
              <div className="bg-error-container/20 border border-error/50 text-error text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between mt-sm">
              <label className="flex items-center gap-xs cursor-pointer group">
                <input className="w-4 h-4 rounded border-border-light bg-[#1f1f1f] text-primary-container focus:ring-primary-container focus:ring-offset-background cursor-pointer" type="checkbox"/>
                <span className="font-small-base text-small-base text-text-secondary group-hover:text-text-emphasis transition-colors">Ghi nhớ đăng nhập</span>
              </label>
              <a className="font-small-bold text-small-bold text-text-emphasis hover:text-primary-container transition-colors underline-offset-2 hover:underline cursor-pointer" href="#">Quên mật khẩu?</a>
            </div>

            <button 
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className="w-full bg-primary-container hover:bg-[#3be477] text-on-primary-fixed rounded-full py-4 mt-md font-button-uppercase text-button-uppercase uppercase tracking-[1.5px] shadow-[0_4px_12px_rgba(30,215,96,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
            >
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="w-full h-px bg-[#282828] my-lg"></div>

          <div className="text-center font-body-base text-body-base text-text-secondary">
            Bạn chưa có tài khoản? 
            <a className="text-text-emphasis font-body-bold hover:text-primary-container transition-colors underline-offset-2 hover:underline ml-1 cursor-pointer" href="/register">Đăng ký</a>
          </div>

          <div className="mt-xl text-center">
            <p className="font-micro text-micro text-border-light">UET AI System — Nhóm dự án môn học</p>
          </div>
        </div>
      </main>
    </div>
  );
}