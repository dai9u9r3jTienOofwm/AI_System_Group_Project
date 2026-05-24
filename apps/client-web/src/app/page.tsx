'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Bot, AlertCircle, Paperclip, Loader2 } from 'lucide-react';

import MessageItem from '@/components/MessageItem';
import Sidebar from '@/components/Sidebar';
import DocumentPicker from '@/components/DocumentPicker';
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
          document_ids: attachedDocIds,
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

      setAttachedDocIds([]);
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
    <div className="flex h-screen bg-gray-50 overflow-hidden text-gray-800">
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

      <div className="flex-1 flex flex-col relative w-full max-w-5xl mx-auto border-x bg-white shadow-sm">
        <header className="h-16 flex items-center justify-between px-4 border-b bg-white shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md"
              aria-label="Mở sidebar"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-2">
              <Bot className="text-blue-600" size={24} />
              <h1 className="font-semibold text-gray-800">Trợ lý AI RAG</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 hidden sm:inline-block">
              Bối cảnh:
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

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 flex items-center gap-2 border-b border-red-100 text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-white"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <Bot size={48} className="opacity-20" />
              <p className="text-sm text-center">
                Hãy chọn chủ đề ở bối cảnh hoặc đính kèm tài liệu để bắt đầu!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm italic pl-2">
              <span className="animate-pulse">AI đang suy nghĩ...</span>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t shrink-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <DocumentPicker
              selectedIds={attachedDocIds}
              onChangeIds={setAttachedDocIds}
              currentTopic={selectedTopic}
            />

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.md,.txt,.py,.c,.cpp,.h,.asm,.yml,.yaml,.json"
              disabled={isFileUploading || isLoading}
            />

            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isFileUploading || isLoading || !selectedTopic}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                selectedTopic
                  ? 'Tải tài liệu mới lên'
                  : 'Vui lòng chọn chủ đề trước'
              }
            >
              {isFileUploading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Paperclip size={12} />
              )}
              Tải tài liệu mới
            </button>
          </div>

          {uploadingFile && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 w-fit shadow-sm">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span className="text-xs font-medium text-gray-700 truncate max-w-[240px]">
                {uploadingFile.name}
              </span>
              <span className="text-[11px] text-gray-400">
                Đang nạp dữ liệu...
              </span>
            </div>
          )}

          {attachedDocIds.length > 0 && (
            <div className="text-[11px] text-gray-500">
              Đã đính kèm {attachedDocIds.length} tài liệu cho câu hỏi tiếp theo.
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedTopic
                  ? `Hỏi AI về chủ đề ${selectedTopic}...`
                  : 'Chọn bối cảnh để đặt câu hỏi...'
              }
              disabled={isLoading || isFileUploading}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 bg-white disabled:opacity-60"
            />

            <button
              type="submit"
              disabled={
                isLoading ||
                isFileUploading ||
                !input.trim() ||
                !selectedTopic
              }
              className="bg-blue-600 text-white px-6 py-3 text-sm rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              Gửi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}