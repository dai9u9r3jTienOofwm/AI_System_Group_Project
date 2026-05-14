/**
 * Dashboard Layout - Bố cục chính cho trang quản lý (admin dashboard)
 * 
 * Tác dụng:
 * - Tạo 2 cột: Sidebar (trái) + Main content (phải)
 * - Thêm Topbar (thanh tiêu đề) ở đầu main content
 * - Bất kỳ trang nào trong /dashboard sẽ dùng layout này
 * 
 * Cấu trúc:
 * ┌─────────────────────────────┐
 * │ ┌─────────┬────────────┐     │
 * │ │         │  Topbar    │     │  <- Topbar
 * │ │ Sidebar ├────────────┤     │
 * │ │         │  children  │     │  <- Page content
 * │ │         │            │     │
 * │ └─────────┴────────────┘     │
 * └─────────────────────────────┘
 */

import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

export default function DashboardLayout({
  children,  // Nội dung của các trang con (page.tsx)
}: {
  children: React.ReactNode;
}) {
  return (
    // Flex container: Sidebar + Main content
    <div className="flex min-h-screen w-full bg-[hsl(224,71%,4%)] text-xl">
      {/* Sidebar: Menu chính ở bên trái */}
      <Sidebar />

      {/* Phần bên phải: Topbar + nội dung trang */}
      <div className="flex-1 flex flex-col min-w-0">  {/* flex-1: chiếm hết không gian còn lại */}
        {/* Topbar: Thanh tiêu đề ở đầu */}
        <Topbar />
        
        {/* Main content: Nơi hiển thị nội dung của các trang con */}
        <main className="flex-1 overflow-y-auto">
          {children}  {/* page.tsx sẽ được render ở đây */}
        </main>
      </div>
    </div>
  );
}