'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bot } from 'lucide-react';
import MessageItem from '@/components/MessageItem';
import ChatInput from '@/components/ChatInput';
import Sidebar from '@/components/Sidebar';
import DocumentPicker from '@/components/DocumentPicker';
import { useConversations } from '@/hooks/useConversations';
import type { Message } from '@/hooks/useConversations';

export default function ChatPage() {
  const {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    createNew,
    updateMessages,
    deleteConversation,
    pinConversation,
    renameConversation,
  } = useConversations();

  const messages = activeConversation?.messages ?? [];

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Clear input and error when switching conversations
  useEffect(() => {
    setInput('');
    setError(null);
  }, [activeId]);

  const handleLogout = async () => {
    try {
    await fetch('/api/auth/logout', { method: 'POST' });

    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');

    window.location.href = '/login';
  } catch (error) {
    console.error('Lỗi khi đăng xuất:', error);
  }
};

  const handleFormSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    updateMessages(activeId, updatedMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          documentIds: selectedDocIds,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Lỗi không xác định từ máy chủ.');
      }

      updateMessages(activeId, [
        ...updatedMessages,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ AI.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={createNew}
        onDelete={deleteConversation}
        onPin={pinConversation}
        onRename={renameConversation}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="shrink-0 px-4 py-3 border-b border-gray-800 bg-gray-900 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-800 transition-colors shrink-0"
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>
            <span className="font-semibold text-gray-100 truncate text-sm">
              {activeConversation?.title ?? 'UET AI Assistant'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'
              }`}
            />
            <span className="text-xs text-gray-400 hidden sm:block">
              {isLoading ? 'Đang suy nghĩ...' : 'Sẵn sàng'}
            </span>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-950 scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">🤖</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-100">Tôi có thể giúp gì cho bạn?</h2>
              <p className="text-gray-400 mt-2 max-w-md text-sm leading-relaxed">
                Hệ thống RAG đã sẵn sàng. Đặt câu hỏi dựa trên tài liệu đã được tải lên,
                hoặc chọn tài liệu cụ thể bằng nút{' '}
                <span className="font-medium text-blue-600">Tài liệu tham khảo</span>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col w-full pb-36">
              {messages.map(m => (
                <MessageItem
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  sources={m.sources}
                />
              ))}
              {isLoading && (
                <div className="flex w-full p-4 bg-gray-900">
                  <div className="flex max-w-4xl mx-auto w-full gap-4 items-center">
                    <div className="w-8 h-8 flex items-center justify-center rounded-sm bg-gray-700 shrink-0">
                      <Bot size={20} className="text-blue-600" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="shrink-0 mx-auto w-full max-w-4xl px-4 py-2">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex justify-between items-center">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-4 font-bold hover:text-red-900"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 w-full px-4 pb-4 pt-2 md:px-6 md:pb-6 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent">
          <div className="max-w-4xl mx-auto">
            <div className="mb-2">
              <DocumentPicker
                selectedIds={selectedDocIds}
                onChangeIds={setSelectedDocIds}
              />
            </div>
            <ChatInput
              input={input}
              handleInputChange={(e) => setInput(e.target.value)}
              handleSubmit={handleFormSubmit}
              isLoading={isLoading}
            />
            <p className="text-center text-xs text-gray-500 mt-2">
              AI có thể mắc sai lầm. Hãy kiểm tra lại các thông tin quan trọng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
