/**
 * Topbar Component - Thanh tiêu đề ở đầu trang dashboard
 * 
 * Tác dụng:
 * - Hiển thị thông tin người dùng hiện tại
 * - Nút thông báo (notification)
 * - Có thể mở rộng với tìm kiếm, profile menu, etc.
 */
"use client";

import React from 'react';
import { Bell } from 'lucide-react';  // Icon chuông thông báo
import { cn } from '@/lib/utils';
import GlobalSearch from '@/components/layout/GlobalSearch';

export default function Topbar() {
  return (
    // Header: dính ở đầu trang (sticky) với blur effect
    <header className={cn(
      "sticky top-0 h-16 bg-white/5 backdrop-blur-xl border-b border-white/10 z-30 flex items-center justify-between px-6 transition-all duration-300",
      "w-full"
    )}>
      {/* Phần bên trái: Dành cho Global Search */}
      <div className="flex-1 max-w-md">
        <GlobalSearch />
      </div>

      {/* Phần bên phải: Thông báo, profile, etc. */}
      <div className="flex items-center gap-4">
        {/* <IngestProgress /> */}
        <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
          <Bell className="h-5 w-5" />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        {/* <UserMenu /> */}
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium text-white">
              A
            </div>
            <span className="text-sm font-medium text-white/90">Admin</span>
        </div>
      </div>
    </header>
  );
}