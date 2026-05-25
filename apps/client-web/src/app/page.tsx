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
    <>
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

      {/* Main Content Canvas */}
      <main className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
        {/* Top App Bar (Mobile / Status) */}
        <header className="flex justify-between items-center w-full px-lg h-16 sticky top-0 z-40 bg-background/90 backdrop-blur-md">
          <div className="md:hidden flex items-center gap-sm">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-text-secondary hover:text-text-emphasis transition-colors shrink-0 cursor-pointer"
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>
            <div className="w-6 h-6 ml-2 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: "16px" }}>robot_2</span>
            </div>
            <span className="text-feature-heading font-feature-heading text-text-emphasis">UET AI</span>
          </div>
          <div className="hidden md:flex text-feature-heading font-feature-heading text-text-emphasis tracking-tight">
            {activeConversation?.title ?? 'Cuộc trò chuyện mới'}
          </div>
          <div className="flex items-center gap-xs text-small-base font-small-base text-text-secondary">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                isLoading ? 'bg-warning animate-pulse' : 'bg-primary-container'
              }`}
            />
            <span className="hidden sm:inline">
              {isLoading ? 'Đang suy nghĩ...' : 'Sẵn sàng'}
            </span>
          </div>
        </header>

        {/* Empty State / Messages */}
        <div ref={scrollRef} className="flex-1 flex flex-col px-lg overflow-y-auto pb-40 scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#f0f0f0] flex items-center justify-center mb-lg shadow-dialog">
                <span className="text-3xl">🤖</span>
              </div>
              <h1 className="w-full text-section-title font-section-title text-text-emphasis mb-md tracking-tight">Tôi có thể giúp gì cho bạn?</h1>
              <p className="w-full text-body-base font-body-base text-text-secondary max-w-[448px] mx-auto leading-relaxed">
                Hệ thống RAG đã sẵn sàng. Đặt câu hỏi dựa trên tài liệu đã được tải lên, hoặc chọn tài liệu cụ thể bằng nút <span className="text-announcement cursor-pointer hover:underline">Tài liệu tham khảo</span>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col w-full max-w-4xl mx-auto pb-8 pt-4">
              {messages.map(m => (
                <MessageItem
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  sources={m.sources}
                />
              ))}
              {isLoading && (
                <div className="flex w-full py-4 items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>robot_2</span>
                  </div>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-text-secondary rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="absolute bottom-32 left-0 right-0 mx-auto w-full max-w-4xl px-4 z-50">
            <div className="bg-error-container border border-error text-on-error-container text-sm rounded-lg px-4 py-3 flex justify-between items-center shadow-dialog">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-4 font-bold hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Input Area (Fixed Footer Anchored) */}
        <div className="absolute bottom-0 left-0 right-0 px-lg pb-lg bg-gradient-to-t from-background via-background to-transparent pt-xl">
          <div className="max-w-4xl mx-auto flex flex-col gap-sm">
            <div className="flex justify-start mb-sm">
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
            
            <p className="text-center text-micro font-micro text-text-secondary mt-2 opacity-70">
              AI có thể mắc sai lầm. Hãy kiểm tra lại các thông tin quan trọng.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
