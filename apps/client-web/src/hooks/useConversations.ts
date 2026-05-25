'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  topic: string;
  messages: Message[];
  pinned: boolean;
  updatedAt: string;
}

// Hàm sinh key cô lập theo tài khoản sinh viên
const getStorageKey = (): string => {
  if (typeof window === 'undefined') return 'uet_ai_conversations_anonymous';
  const userId = localStorage.getItem('userId');
  // Nếu có tài khoản thì găm theo ID, không thì dùng key cô lập tạm thời
  return userId ? `uet_ai_conversations_${userId}` : 'uet_ai_conversations_anonymous';
};

const makeNew = (): Conversation => ({
  id: Date.now().toString(),
  title: 'Cuộc trò chuyện mới',
  topic: '',
  messages: [],
  pinned: false,
  updatedAt: new Date().toISOString(),
});

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Lắng nghe sự thay đổi tài khoản để quét sạch giao diện cũ, nạp lịch sử mới
  useEffect(() => {
    setInitialized(false);
    const key = getStorageKey();
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const convs: Conversation[] = JSON.parse(stored).map((c: Conversation) => ({
          ...c,
          topic: c.topic ?? '',
        }));
        if (convs.length > 0) {
          setConversations(convs);
          setActiveId(convs[0].id);
          setInitialized(true);
          return;
        }
      }
    } catch {
      /* Dữ liệu lỗi - clear */
    }

    const initial = makeNew();
    setConversations([initial]);
    setActiveId(initial.id);
    setInitialized(true);
    
    // Tín hiệu kích hoạt lại khi userId thay đổi dữ liệu
  }, [typeof window !== 'undefined' ? localStorage.getItem('userId') : null]);

  useEffect(() => {
    if (initialized) {
      const key = getStorageKey();
      localStorage.setItem(key, JSON.stringify(conversations));
    }
  }, [conversations, initialized]);

  const createNew = useCallback(() => {
    const conv = makeNew();
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
  }, []);

  const updateMessages = useCallback((id: string, messages: Message[]) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== id) return c;
        const firstUser = messages.find(m => m.role === 'user')?.content ?? '';
        const title = firstUser
          ? firstUser.slice(0, 45) + (firstUser.length > 45 ? '...' : '')
          : c.title;
        return { ...c, messages, title, updatedAt: new Date().toISOString() };
      })
    );
  }, []);

  const updateTopic = useCallback((id: string, topic: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, topic, updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (filtered.length === 0) {
        const initial = makeNew();
        setActiveId(initial.id);
        return [initial];
      }
      if (activeId === id) {
        setActiveId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeId]);

  const pinConversation = useCallback((id: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title } : c))
    );
  }, []);

  return {
    conversations,
    activeId,
    activeConversation: conversations.find(c => c.id === activeId) || null,
    setActiveId,
    createNew,
    updateMessages,
    updateTopic,
    deleteConversation,
    pinConversation,
    renameConversation,
  };
}