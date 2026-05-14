import { useState, useEffect, useCallback } from 'react';

export interface Source {
  fileName: string;
  pageNumber?: number;
  snippet?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
}

const STORAGE_KEY = 'uet_ai_conversations';

function makeNew(): Conversation {
  return {
    id: Date.now().toString(),
    title: 'Cuộc trò chuyện mới',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinned: false,
  };
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const convs: Conversation[] = JSON.parse(stored);
        if (convs.length > 0) {
          setConversations(convs);
          setActiveId(convs[0].id);
          setInitialized(true);
          return;
        }
      }
    } catch { /* corrupted data — start fresh */ }

    const initial = makeNew();
    setConversations([initial]);
    setActiveId(initial.id);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
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

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh = makeNew();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === prev.find(c => c.id === id)?.id) {
        setActiveId(next[0].id);
      }
      return next;
    });
  }, []);

  const pinConversation = useCallback((id: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c)
    );
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title: trimmed } : c)
    );
  }, []);

  const activeConversation = conversations.find(c => c.id === activeId) ?? null;

  return {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    createNew,
    updateMessages,
    deleteConversation,
    pinConversation,
    renameConversation,
  };
}
