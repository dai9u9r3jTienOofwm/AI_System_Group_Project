'use client';

import { ConfigProvider, theme } from 'antd';
import AdminSidebar from '@/components/admin/Sidebar';
import AdminTopbar from '@/components/admin/Topbar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <div className="flex min-h-screen w-full bg-[hsl(224,71%,4%)] text-xl">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ConfigProvider>
  );
}
