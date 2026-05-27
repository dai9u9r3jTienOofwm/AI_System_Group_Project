'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const values = { 
        username: username.trim(),
        email: email.trim(), 
        password: password 
      };

      const data = await apiClient.client.post('/v1/auth/register', values) as any;

      if (data.status === 'success') {
        alert('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
        router.push('/login');
      }

    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Lỗi hệ thống! Vui lòng thử lại sau.';
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
            <h1 className="font-section-title text-section-title text-text-emphasis text-center mb-xs">Tạo tài khoản mới</h1>
            <p className="font-body-base text-body-base text-text-secondary text-center">UET AI Assistant</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-lg">
            <div className="flex flex-col gap-sm">
              <label className="font-body-bold text-body-bold text-text-emphasis" htmlFor="username">Tên đăng nhập</label>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
                  person
                </span>
                <input 
                  className="w-full bg-[#1f1f1f] text-text-emphasis placeholder-text-secondary rounded-full py-3 pl-12 pr-4 shadow-inset-input focus:outline-none focus:ring-1 focus:ring-primary-container transition-all" 
                  id="username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: tien_uet" 
                  autoComplete="username"
                  type="text"
                />
              </div>
            </div>

            <div className="flex flex-col gap-sm">
              <label className="font-body-bold text-body-bold text-text-emphasis" htmlFor="email">Địa chỉ Email</label>
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
                  mail
                </span>
                <input 
                  className="w-full bg-[#1f1f1f] text-text-emphasis placeholder-text-secondary rounded-full py-3 pl-12 pr-4 shadow-inset-input focus:outline-none focus:ring-1 focus:ring-primary-container transition-all" 
                  id="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="username@example.com" 
                  autoComplete="email"
                  type="email"
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
                  placeholder="Nhập mật khẩu bảo mật" 
                  autoComplete="new-password"
                  type="password"
                />
              </div>
            </div>

            {error && (
              <div className="bg-error-container/20 border border-error/50 text-error text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading || !username.trim() || !email.trim() || !password.trim()}
              className="w-full bg-primary-container hover:bg-[#3be477] text-on-primary-fixed rounded-full py-4 mt-sm font-button-uppercase text-button-uppercase uppercase tracking-[1.5px] shadow-[0_4px_12px_rgba(30,215,96,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
            >
              {isLoading ? 'Đang tạo tài khoản...' : 'Xác nhận Đăng ký'}
            </button>
          </form>

          <div className="w-full h-px bg-[#282828] my-lg"></div>

          <div className="text-center font-body-base text-body-base text-text-secondary">
            Đã có tài khoản?{' '}
            <a className="text-text-emphasis font-body-bold hover:text-primary-container transition-colors underline-offset-2 hover:underline ml-1 cursor-pointer" href="/login">Đăng nhập tại đây</a>
          </div>

          <div className="mt-xl text-center">
            <p className="font-micro text-micro text-border-light">UET AI System — Nhóm dự án môn học</p>
          </div>
        </div>
      </main>
    </div>
  );
}