'use client';

import { useState, useRef, useEffect } from 'react';
import { PlusCircle, MessageSquare, Trash2, LogOut, Bot, X, Pin, PinOff, Pencil } from 'lucide-react';
import type { Conversation } from '@/hooks/useConversations';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

// 🌟 Định nghĩa kiểu dữ liệu User nhận về từ Endpoint /v1/auth/me
interface UserInfo {
  username: string;
  email: string;
  role: string;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onPin,
  onRename,
  onLogout,
  isOpen,
  setIsOpen,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 🌟 State quản lý thông tin User Profile
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // 🌟 Fetch thông tin cá nhân khi cấu trúc Sidebar được load
  useEffect(() => {
    fetch('/v1/auth/me')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Chưa xác thực session');
      })
      .then((data) => setUser(data))
      .catch((err) => console.error('Profile fetch error:', err))
      .finally(() => setLoadingUser(false));
  }, []);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const startEdit = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.title);
  };

  const finishEdit = () => {
    if (editingId) onRename(editingId, editValue);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const pinned = conversations.filter(c => c.pinned);
  const unpinned = conversations.filter(c => !c.pinned);
  const hasBothGroups = pinned.length > 0 && unpinned.length > 0;

  const renderItem = (conv: Conversation) => {
    const isActive = conv.id === activeId;
    const isEditing = editingId === conv.id;

    return (
      <div
        key={conv.id}
        onClick={() => {
          if (isEditing) return;
          onSelect(conv.id);
          setIsOpen(false);
        }}
        className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isActive
            ? 'bg-gray-700 text-white'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`}
      >
        {conv.pinned
          ? <Pin size={12} className="shrink-0 text-blue-400" />
          : <MessageSquare size={12} className="shrink-0 opacity-40" />
        }

        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
              if (e.key === 'Escape') cancelEdit();
            }}
            onClick={e => e.stopPropagation()}
            className="flex-1 bg-gray-600 text-white text-xs px-2 py-0.5 rounded outline-none border border-blue-500 min-w-0"
          />
        ) : (
          <span className="flex-1 truncate text-xs leading-5 select-none">
            {conv.title}
          </span>
        )}

        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onPin(conv.id); }}
              title={conv.pinned ? 'Bỏ ghim' : 'Ghim'}
              className={`p-1 rounded transition-colors ${
                conv.pinned
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-gray-500 hover:text-blue-400'
              }`}
            >
              {conv.pinned ? <PinOff size={12} /> : <Pin size={12} />}
            </button>
            <button
              onClick={e => startEdit(conv, e)}
              title="Đổi tên"
              className="p-1 rounded text-gray-500 hover:text-white transition-colors"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
              title="Xóa"
              className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Trích xuất chữ cái đầu tiên phục vụ việc vẽ Avatar giống ChatGPT
  const avatarLetter = user?.username ? user.username.charAt(0).toUpperCase() : 'U';

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30
          w-64 bg-gray-900 text-white flex flex-col shrink-0
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header hệ thống */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-700/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
              <Bot size={15} />
            </div>
            <span className="font-semibold text-sm tracking-tight">UET AI</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Nút hành động thêm cuộc hội thoại mới */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => { onNew(); setIsOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            <PlusCircle size={15} className="text-blue-400 shrink-0" />
            Cuộc trò chuyện mới
          </button>
        </div>

        {/* Khu vực hiển thị danh sách lịch sử phiên chat */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.length === 0 ? (
            <p className="text-gray-500 text-xs text-center py-6">Chưa có cuộc trò chuyện nào</p>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1">
                    <Pin size={9} /> Đã ghim
                  </p>
                  <div className="space-y-0.5">{pinned.map(renderItem)}</div>
                </div>
              )}

              {unpinned.length > 0 && (
                <div>
                  {hasBothGroups && (
                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Gần đây
                    </p>
                  )}
                  <div className="space-y-0.5">{unpinned.map(renderItem)}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 🌟 PHẦN CẢI TIẾN CỐT LÕI: Khối thông tin User & Đăng xuất (Bám đáy Sidebar) */}
        <div className="mt-auto border-t border-gray-800 p-3 bg-gray-950/80 flex flex-col gap-2.5">
          {loadingUser ? (
            <div className="text-[11px] text-gray-500 px-2 py-1 animate-pulse">
              Đang tải thông tin tài khoản...
            </div>
          ) : user ? (
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5 overflow-hidden">
                {/* Avatar vòng tròn phong cách ChatGPT */}
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-sm">
                  {avatarLetter}
                </div>
                
                {/* Text thông tin chi tiết */}
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-xs font-semibold text-gray-200 truncate leading-4">
                    {user.username}
                  </span>
                  <span className="text-[10px] text-gray-400 truncate leading-3 mt-0.5">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Badge phân quyền nếu User mang quyền Quản trị hệ thống */}
              {user.role === 'admin' && (
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded font-mono scale-90 origin-right">
                  ADMIN
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-amber-500/80 px-1.5">
              ⚠ Chế độ Khách (Guest)
            </div>
          )}

          {/* Nút đăng xuất nguyên bản giữ nguyên liên kết xử lý */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800/60 text-xs font-medium transition-all"
          >
            <LogOut size={13} className="shrink-0" />
            Đăng xuất khỏi hệ thống
          </button>
        </div>
      </aside>
    </>
  );
}