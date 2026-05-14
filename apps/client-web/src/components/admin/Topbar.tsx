'use client';

import { Bell } from 'lucide-react';
import AdminGlobalSearch from './GlobalSearch';

export default function AdminTopbar() {
  return (
    <header className="sticky top-0 h-16 bg-white/5 backdrop-blur-xl border-b border-white/10 z-30 flex items-center justify-between px-6 w-full">
      <div className="flex-1 max-w-md">
        <AdminGlobalSearch />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white">
          <Bell className="h-5 w-5" />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
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
