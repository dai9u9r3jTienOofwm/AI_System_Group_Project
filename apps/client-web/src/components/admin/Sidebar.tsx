'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Database,
  FileText,
  Users,
  Settings,
  Zap,
  ChevronRight,
  LogOut,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, type Dispatch, type SetStateAction } from 'react';

type NavChild = { icon: LucideIcon; label: string; path: string };
type NavItemEntry = NavChild & { children?: NavChild[] };

const navItems: NavItemEntry[] = [
  { icon: LayoutDashboard, label: 'Tổng quan', path: '/admin' },
  {
    icon: Database,
    label: 'Quản lý Tài liệu',
    path: '/admin/documents',
    children: [
      { icon: FileText, label: 'Tài liệu', path: '/admin/documents' },
      { icon: LayoutDashboard, label: 'Trạng thái Ingest', path: '/admin/ingest-status' },
    ],
  },
  { icon: Users, label: 'Quản lý Người dùng', path: '/admin/users' },
  { icon: Settings, label: 'Cấu hình', path: '/admin/settings' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (item: NavItemEntry) => {
    if (item.path === '/admin') return pathname === '/admin';
    if (item.children) {
      return item.children.some((c) => pathname.startsWith(c.path)) || pathname.startsWith(item.path);
    }
    return pathname.startsWith(item.path);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="w-72 min-h-screen bg-[hsl(224,71%,4%)] flex flex-col border-r border-white/10 text-lg">
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

      <div className="px-5 py-6 border-t border-white/10 space-y-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
          <div className="w-9 h-9 bg-blue-600/20 rounded-full flex items-center justify-center">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white/80 text-base font-medium truncate">RAG Chatbot v1.0</p>
            <p className="text-white/40 text-sm">System Active</p>
          </div>
          <div className="w-2.5 h-2.5 bg-green-400 rounded-full flex-shrink-0 animate-pulse" />
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-lg transition-all',
            'text-white/60 hover:text-white hover:bg-red-500/20',
            loggingOut && 'opacity-50 cursor-not-allowed'
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
  const router = useRouter();
  const active = isActive(item);
  const hasChildren = (item.children?.length ?? 0) > 0;
  const isChildActive = item.children?.some((c) => pathname.startsWith(c.path)) ?? false;
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
            'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg transition-all',
            active ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          <item.icon className="w-6 h-6 flex-shrink-0" />
          <span className="font-semibold flex-1 text-left">{item.label}</span>
          <ChevronRight className={cn('w-5 h-5 transition-transform', isExpanded && 'rotate-90')} />
        </button>

        <div className={cn('grid transition-all duration-300', isExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0')}>
          <div className="overflow-hidden">
            <div className="space-y-1.5 border-l-2 border-white/10 ml-6 pl-4">
              {item.children?.map((child) => (
                <button
                  key={child.path}
                  onClick={() => router.push(child.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-base transition-all text-left',
                    pathname === child.path
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
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
        'w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-lg transition-all text-left',
        active
          ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/40'
          : 'text-white/60 hover:text-white hover:bg-white/5'
      )}
    >
      <item.icon className="w-6 h-6 flex-shrink-0" />
      <span>{item.label}</span>
    </button>
  );
}
