/**
 * Dashboard Home Page - Trang tổng quan chính của dashboard
 * 
 * Tác dụng:
 * - Hiển thị các thẻ (card) liên kết tới các khu vực quản lý khác nhau
 * - Người dùng có thể nhấp vào từng thẻ để điều hướng tới trang tương ứng
 * - Một cái cửa ngõ để dễ dàng truy cập các tính năng chính của hệ thống
 */

import Link from 'next/link';

// Định nghĩa các section (khu vực) được hiển thị trên trang tổng quan
const sections = [
  {
    title: 'Documents',
    href: '/dashboard/documents',
    description: 'Quản lý và tải lên tài liệu.',
  },
  {
    title: 'Users',
    href: '/dashboard/users',
    description: 'Quản lý người dùng hệ thống.',
  },
  {
    title: 'Ingest Status',
    href: '/dashboard/ingest-status',
    description: 'Theo dõi tiến trình ingest.',
  },
  {
    title: 'Chat Session',
    href: '/dashboard/chat_session',
    description: 'Hiển thị lịch sử đoạn chat của người dùng.',
  }
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,1)_55%,_rgba(0,0,0,1)_100%)] px-6 py-12 text-slate-100 md:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-7xl space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Dashboard</h1>
          <p className="max-w-xl text-base text-slate-300">
            Chọn một khu vực để làm việc.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-slate-900/90"
            >
              <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                <div className="absolute -right-10 top-6 h-28 w-28 rounded-full bg-cyan-500/20 blur-2xl" />
                <div className="absolute -left-8 bottom-4 h-20 w-20 rounded-full bg-indigo-500/20 blur-2xl" />
              </div>
              <div className="relative space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Section</p>
                <h2 className="text-2xl font-semibold text-white">
                  {section.title}
                </h2>
                <p className="text-sm text-slate-300">{section.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}