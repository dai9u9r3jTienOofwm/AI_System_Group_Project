'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Bot, AlertCircle, Paperclip, Loader2 } from 'lucide-react';

import MessageItem from '@/components/MessageItem';
import Sidebar from '@/components/Sidebar';
import DocumentPicker from '@/components/DocumentPicker';
import ChatInput from '@/components/ChatInput';
import { useConversations } from '@/hooks/useConversations';
import type { Message } from '@/hooks/useConversations';

type UploadResponse = {
  success?: boolean;
  document_id?: string;
  id?: string;
  error?: string;
  detail?: string;
  message?: string;
  data?: {
    id?: string;
    document_id?: string;
  };
};

type ChatResponse = {
  answer?: string;
  sources?: unknown;
  error?: string;
  detail?: string;
  message?: string;
};

export default function ChatPage() {
  const conversationsHook = useConversations();

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
  } = conversationsHook;

  /**
   * Dùng optional để tránh lỗi build nếu hook useConversations
   * chưa khai báo updateTopic trong type.
   */
  const updateTopic = (
    conversationsHook as unknown as {
      updateTopic?: (conversationId: string, topic: string) => void;
    }
  ).updateTopic;

  const messages = activeConversation?.messages ?? [];

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);

  const [selectedTopic, setSelectedTopic] = useState('');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedSessionIds = useRef<Set<string>>(new Set());
  const shouldClearDocsRef = useRef<boolean>(false);  // 🌟 Flag to clear docs on next submit

  const fetchTopics = useCallback(async () => {
    setTopicsLoading(true);

    try {
      const res = await fetch('/api/documents/topics');

      if (!res.ok) {
        throw new Error('Không thể tải danh sách chủ đề.');
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setAvailableTopics(data);
      } else if (data && Array.isArray(data.topics)) {
        setAvailableTopics(data.topics);
      } else {
        setAvailableTopics([]);
      }
    } catch (err) {
      console.error('Error loading topics:', err);
      setAvailableTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    setInput('');
    setError(null);
    setAttachedDocIds([]);

    const conversationTopic =
      (activeConversation as unknown as { topic?: string } | undefined)?.topic ?? '';

    setSelectedTopic(conversationTopic);
  }, [activeId, activeConversation]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      window.location.href = '/login';
    } catch (err) {
      console.error('Lỗi khi đăng xuất:', err);
      setError('Không thể đăng xuất. Vui lòng thử lại.');
    }
  };

  const triggerFileInput = () => {
    if (isFileUploading || isLoading) return;
    fileInputRef.current?.click();
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const userId = localStorage.getItem('userId') || 'guest';

    if (!file) return;

    if (!selectedTopic) {
      setError('Vui lòng chọn một Chủ đề trước khi tải tài liệu.');
      resetFileInput();
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Tệp tin quá lớn. Vui lòng chọn tệp dưới 10MB.');
      resetFileInput();
      return;
    }
    
    setUploadingFile(file);
    setIsFileUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('topic', selectedTopic);
    formData.append('user_id', userId);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = (await res.json().catch(() => ({}))) as UploadResponse;

      if (!res.ok) {
        throw new Error(
          result.error ||
            result.detail ||
            result.message ||
            'Upload tài liệu thất bại.'
        );
      }

      const newDocId =
        result.document_id ||
        result.id ||
        result.data?.document_id ||
        result.data?.id;

      if (!newDocId) {
        throw new Error('Backend đã upload xong nhưng không trả về document_id.');
      }

      setAttachedDocIds((prev) => {
        if (prev.includes(newDocId)) return prev;
        return [...prev, newDocId];
      });

      setError(null);
    } catch (err) {
      console.error('Lỗi khi tải file lên:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi tải tài liệu lên.'
      );
    } finally {
      setIsFileUploading(false);
      setUploadingFile(null);
      resetFileInput();
    }
  };

  const handleChangeTopic = (newTopic: string) => {
    setSelectedTopic(newTopic);
    setAttachedDocIds([]);

    if (activeId) {
      updateTopic?.(activeId, newTopic);
    }

    if (error) {
      setError(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const question = input.trim();
    const userId = localStorage.getItem('userId') || 'guest';

    if (!question || isLoading || isFileUploading || !activeId) return;

    if (!selectedTopic) {
      setError('Vui lòng chọn một Chủ đề trước khi nhắn tin.');
      return;
    }

    // 🌟 FIX: Clear docs from PREVIOUS message (if any)
    // This way they stay visible through current Q&A cycle
    if (shouldClearDocsRef.current) {
      setAttachedDocIds([]);
      shouldClearDocsRef.current = false;
    }

    // Save current docs before any state changes
    const currentDocIds = attachedDocIds;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
    };

    const updatedMessages: Message[] = [...messages, userMessage];

    updateMessages(activeId, updatedMessages);

    setInput('');
    setIsLoading(true);
    setError(null);

    // Lưu session vào DB lần đầu tiên mỗi conversation
    if (activeId && !savedSessionIds.current.has(activeId)) {
      savedSessionIds.current.add(activeId);
      fetch('/api/chat-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic,
          title: question.slice(0, 50),
        }),
      }).catch(() => {});
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          topic: selectedTopic,
          document_ids: currentDocIds,  // 🌟 Use saved document_ids from before clearing
          user_id: userId,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as ChatResponse;

      if (!res.ok || data.error) {
        throw new Error(
          data.error ||
            data.detail ||
            data.message ||
            'Lỗi từ máy chủ AI.'
        );
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || 'AI không trả về nội dung.',
        sources: data.sources,
      } as Message;

      updateMessages(activeId, [...updatedMessages, assistantMessage]);
      
      // 🌟 Mark to clear docs on next form submit
      shouldClearDocsRef.current = true;
    } catch (err) {
      console.error('Lỗi khi gửi câu hỏi:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối đến máy chủ AI.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={createNew}
        onDelete={deleteConversation}
        onPin={pinConversation}
        onRename={renameConversation}
        onLogout={handleLogout}
      />

      {/* Main Content Canvas */}
      <main className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
        {/* Top App Bar (Mobile / Status) */}
        <header className="flex justify-between items-center w-full px-lg h-16 sticky top-0 z-40 bg-background/90 backdrop-blur-md">
          <div className="md:hidden flex items-center gap-sm">
            <button
              type="button"
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

            <select
              className="border p-1.5 rounded-md text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-gray-700"
              value={selectedTopic}
              onChange={(e) => handleChangeTopic(e.target.value)}
              disabled={messages.length > 0 || topicsLoading}
            >
              <option value="" disabled>
                {topicsLoading ? '-- Đang tải... --' : '-- Chọn chủ đề --'}
              </option>

              {availableTopics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
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
                  message={m}
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
                selectedIds={attachedDocIds}
                onChangeIds={setAttachedDocIds}
                currentTopic={selectedTopic}
              />
            </div>
            
            <ChatInput
              input={input}
              handleInputChange={(e) => setInput(e.target.value)}
              handleSubmit={handleFormSubmit}
              isLoading={isLoading}
              selectedDocIds={attachedDocIds}
              onChangeDocIds={setAttachedDocIds}
              currentTopic={selectedTopic}
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