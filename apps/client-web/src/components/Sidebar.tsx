'use client';

import { useState, useRef, useEffect } from 'react';
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
  onClose: () => void;
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
  onClose,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
          onClose();
        }}
        className={`group flex items-center gap-md px-sm py-2 rounded-md cursor-pointer transition-colors duration-200 ${
          isActive
            ? 'bg-surface-container-high text-text-emphasis font-nav-link-active'
            : 'text-text-secondary font-nav-link-inactive hover:text-text-emphasis hover:bg-[#ffffff1a]'
        }`}
      >
        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
          {conv.pinned ? 'keep' : 'chat_bubble'}
        </span>

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
            className="flex-1 bg-surface-variant text-text-emphasis text-sm px-2 py-0.5 rounded outline-none border border-border-light min-w-0 font-nav-link-inactive"
          />
        ) : (
          <span className="flex-1 truncate text-sm leading-5 select-none">
            {conv.title}
          </span>
        )}

        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); onPin(conv.id); }}
              title={conv.pinned ? 'Bỏ ghim' : 'Ghim'}
              className={`p-1 rounded transition-colors cursor-pointer ${
                conv.pinned
                  ? 'text-primary hover:text-primary-fixed'
                  : 'text-text-secondary hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{conv.pinned ? 'keep_off' : 'keep'}</span>
            </button>
            <button
              onClick={e => startEdit(conv, e)}
              title="Đổi tên"
              className="p-1 rounded text-text-secondary hover:text-text-emphasis transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
              title="Xóa"
              className="p-1 rounded text-text-secondary hover:text-negative transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <nav
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-[280px] bg-panel-surface h-full flex flex-col p-md shrink-0
          transform transition-transform duration-200 ease-in-out shadow-dialog rounded-r-lg md:rounded-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between mb-xl px-sm">
          <div className="flex items-center gap-md">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: "20px" }}>robot_2</span>
            </div>
            <span className="text-section-title font-section-title text-text-emphasis tracking-tight">UET AI</span>
          </div>
          <button onClick={onClose} className="md:hidden text-text-secondary hover:text-text-emphasis transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <button
          onClick={() => { onNew(); onClose(); }}
          className="w-full bg-primary-container text-black font-nav-link-active rounded-full py-3 px-4 flex items-center justify-center gap-2 mb-lg hover:scale-[1.02] active:scale-95 transition-transform duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          Cuộc trò chuyện mới
        </button>

        <div className="flex-1 overflow-y-auto flex flex-col gap-sm">
          {conversations.length === 0 ? (
            <p className="text-text-secondary text-sm text-center py-6">Chưa có cuộc trò chuyện nào</p>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="mb-2">
                  <p className="px-sm py-1.5 text-micro font-small-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">keep</span> Đã ghim
                  </p>
                  <div className="flex flex-col gap-sm">{pinned.map(renderItem)}</div>
                </div>
              )}

              {unpinned.length > 0 && (
                <div>
                  {hasBothGroups && (
                    <p className="px-sm py-1.5 text-micro font-small-bold uppercase tracking-wider text-text-secondary">
                      Gần đây
                    </p>
                  )}
                  <div className="flex flex-col gap-sm">{unpinned.map(renderItem)}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-auto pt-md flex flex-col gap-sm">
          <button
            onClick={onLogout}
            className="flex items-center gap-md px-sm py-2 rounded-md text-text-secondary font-nav-link-inactive hover:text-negative hover:bg-[#ffffff1a] transition-colors duration-200 text-left cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Đăng xuất
          </button>
        </div>
      </nav>
    </>
  );
}
