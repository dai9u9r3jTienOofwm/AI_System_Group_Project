'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Lock, User } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Đăng nhập thất bại.');
        return;
      }

      router.push(data.role === 'admin' ? '/admin' : '/');
      router.refresh();
    } catch {
      setError('Không thể kết nối đến máy chủ.');
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
              Tài khoản
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

        <p className="text-center text-xs text-gray-600 mt-6">
          UET AI System — Nhóm dự án môn học
        </p>
      </div>
    </div>
  );
}
