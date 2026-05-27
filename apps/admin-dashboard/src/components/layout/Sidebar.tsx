/**
 * Sidebar Component - Thanh điều hướng bên trái của dashboard
 * 
 * Tác dụng:
 * - Hiển thị menu chính để người dùng navigate đến các trang khác nhau
 * - Logo/branding ở đầu
 * - Nút logout ở cuối
 * 
 * 'use client': Component này cần interactivity (click, hover)
 */

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard,   // Icon tổng quan
  Database,           // Icon tài liệu
  FileText,           // Icon file
  Users,              // Icon người dùng
  Settings,           // Icon cài đặt
  Bot, 
  ChevronRight,       // Icon mũi tên
  Zap,
  LogOut,             // Icon logout
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';  // Hàm combine CSS classes
import { useState, type Dispatch, type SetStateAction } from 'react';
import axios from 'axios';

/** Type cho menu item con (nested) */
type NavChild = {
  icon: LucideIcon;
  label: string;
  path: string;
};

/** Type cho menu item chính (có thể có submenu) */
type NavItemEntry = NavChild & {
  children?: NavChild[];  // Menu con (tùy chọn)
};

/** Khai báo các menu items được hiển thị trên Sidebar */
const navItems: NavItemEntry[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/dashboard' },
  {
    icon: Database, 
    label: 'Quản lý Tài liệu', 
    path: '/dashboard/documents',
    children: [
      { icon: FileText, label: 'Tài liệu', path: '/dashboard/documents' },
      { icon: LayoutDashboard, label: 'Trạng thái Ingest', path: '/dashboard/ingest-status' },
    ]
  },
  { icon: Users, label: 'Quản lý Người dùng', path: '/dashboard/users' },
  { icon: Users, label: 'Quản lý đoạn chat', path: '/dashboard/chat_session'}
];

export default function Sidebar() {
  const pathname = usePathname();  // Lấy đường dẫn hiện tại (VD: /dashboard/users)
  const router = useRouter();  // Hook để chuyển hướng trang
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);  // Menu nào đang mở?
  const [loggingOut, setLoggingOut] = useState(false);  // Đang logout?

  /**
   * Kiểm tra xem menu item nào "active" (hiện tại đang ở trang đó)
   * Dùng để highlight menu item hiện tại
   */
  const isActive = (item: NavItemEntry) => {
    if (item.path === '/dashboard') return pathname === '/dashboard';
    if (item.children) {
      // Nếu có submenu, kiểm tra xem trang hiện tại có nằm trong submenu không
      return item.children.some((child) => pathname.startsWith(child.path)) || pathname.startsWith(item.path);
    }
    return pathname.startsWith(item.path);
  };

  /**
   * Xử lý khi user click logout
   * - Gọi API /api/auth/logout trên backend
   * - Xóa token khỏi localStorage
   * - Chuyển hướng về trang login
   */
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await axios.post('/api/auth/logout');  // Thông báo backend rằng user đã logout
      localStorage.removeItem('authToken');  // Xóa token từ client
      router.push('/login');  // Quay lại trang login
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="w-72 min-h-screen bg-[hsl(224,71%,4%)] flex flex-col border-r border-white/10 text-lg">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xl">RAG Admin</p>
            <p className="text-white/40 text-sm">Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavItem 
            key={item.path} 
            item={item} 
            isActive={isActive}
            expandedMenu={expandedMenu}
            setExpandedMenu={setExpandedMenu}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-6 border-t border-white/10 space-y-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
          <div className="w-9 h-9 bg-blue-600/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white/80 text-base font-medium truncate">RAG Chatbot v1.0</p>
            <p className="text-white/40 text-sm">System Active</p>
          </div>
          <div className="w-2.5 h-2.5 bg-green-400 rounded-full flex-shrink-0 animate-pulse"></div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-lg transition-all",
            "text-white/60 hover:text-white hover:bg-red-500/20",
            loggingOut && "opacity-50 cursor-not-allowed"
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}

type NavItemProps = {
  item: NavItemEntry;
  isActive: (item: NavItemEntry) => boolean;
  expandedMenu: string | null;
  setExpandedMenu: Dispatch<SetStateAction<string | null>>;
  pathname: string;
};

function NavItem({ item, isActive, expandedMenu, setExpandedMenu, pathname }: NavItemProps) {
  const isChildActive = item.children?.some((child) => pathname.startsWith(child.path)) ?? false;
  const router = useRouter();
  const active = isActive(item);
  const hasChildren = (item.children?.length ?? 0) > 0;
  const isExpanded = hasChildren && (expandedMenu === item.path || pathname === item.path || isChildActive);

  const handleClick = () => {
    if (hasChildren) {
      setExpandedMenu(isExpanded ? null : item.path);
    } else {
      router.push(item.path);
    }
  };

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={handleClick}
          className={cn(
            "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg transition-all",
            active ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
          )}
        >
          <item.icon className="w-6 h-6 flex-shrink-0" />
          <span className="font-semibold flex-1 text-left">{item.label}</span>
          <ChevronRight className={cn("w-5 h-5 transition-transform", isExpanded && "rotate-90")} />
        </button>

        <div className={cn(
          "grid transition-all duration-300",
          isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden">
            <div className="space-y-1.5 border-l-2 border-white/10 ml-6 pl-4">
              {item.children?.map((child) => (
                <button
                  key={child.path}
                  onClick={() => router.push(child.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-base transition-all text-left",
                    pathname === child.path
                      ? "bg-blue-600 text-white font-bold"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  )}
                >
                  <child.icon className="w-5 h-5 flex-shrink-0" />
                  {child.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg transition-all text-left",
        active ? "bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/40" : "text-white/60 hover:text-white hover:bg-white/5"
      )}
    >
      <item.icon className="w-6 h-6 flex-shrink-0" />
      <span>{item.label}</span>
    </button>
  );
}
