'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bot, AlertCircle, Paperclip, Loader2 } from 'lucide-react';
import MessageItem from '@/components/MessageItem';
import Sidebar from '@/components/Sidebar';
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
    updateTopic,
    deleteConversation,
    pinConversation,
    renameConversation,
  } = useConversations();

  const messages = activeConversation?.messages ?? [];

  // 🌟 KHAI BÁO STATE ĐÃ ĐƯỢC DỌN DẸP SẠCH SẼ (Không còn trùng lặp)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  
  // State cho File Upload
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State giao diện & Context
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // HÀM TẢI TOPIC LÚC MỚI VÀO TRANG
  const fetchTopics = async () => {
    try {
      const res = await fetch('/api/documents/topics');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAvailableTopics(data);
        } else if (data && Array.isArray(data.topics)) {
          setAvailableTopics(data.topics);
        } else if (data && data.data && Array.isArray(data.data.topics)) {
          setAvailableTopics(data.data.topics);
        } else {
          setAvailableTopics([]);
        }
      }
    } catch (error) {
      console.error('Error loading topics:', error);
    } finally {
      setTopicsLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    setInput('');
    setError(null);
    if (activeConversation) {
      setSelectedTopic(activeConversation.topic || '');
    }
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

  // 🌟 HÀM XỬ LÝ UPLOAD TÀI LIỆU (Đã kẹp Topic vào thẳng FormData)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("Tệp tin quá lớn! Vui lòng chọn tệp dưới 10MB.");
      return;
    }

    setUploadingFile(file); 
    setIsFileUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Kẹp topic hiện tại vào nếu người dùng đã chọn
    if (selectedTopic) {
      formData.append('topic', selectedTopic);
    }

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (res.ok && (result.success || result.data)) {
        // Không cần fetchTopics() nữa vì file đã chui tọt vào đúng Topic rồi
        console.log(`Đã nạp file ${file.name} thành công!`);
      } else {
        setError(`Lỗi upload: ${result.error || 'Xử lý file thất bại'}`);
      }
    } catch (error) {
      console.error("Lỗi khi tải file lên:", error);
      setError("Đã xảy ra lỗi đường truyền khi upload tài liệu!");
    } finally {
      setIsFileUploading(false);
      setUploadingFile(null); // Dọn dẹp state file sau khi up xong
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFormSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeId) return;

    if (!selectedTopic) {
      setError("Vui lòng chọn một Chủ đề (Topic) ở trên trước khi gửi tin nhắn!");
      return;
    }

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
          question: input.trim(), 
          topic: selectedTopic, 
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* SIDEBAR */}
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

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full max-w-5xl mx-auto border-x bg-white shadow-sm">
        
        {/* HEADER CÓ TÍCH HỢP DROPDOWN CHỌN TOPIC */}
        <header className="h-16 flex items-center justify-between px-4 border-b bg-white shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Bot className="text-blue-600" size={24} />
              <h1 className="font-semibold text-gray-800">Trợ lý AI RAG</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 hidden sm:inline-block">Bối cảnh:</span>
            <select
              className="border p-1.5 rounded-md text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              value={selectedTopic}
              onChange={(e) => {
                setSelectedTopic(e.target.value);
                if (activeId) updateTopic(activeId, e.target.value);
                if (error) setError(null);
              }}
              disabled={messages.length > 0 || topicsLoading}
            >
              <option value="" disabled>
                {topicsLoading ? '-- Đang tải... --' : '-- Chọn chủ đề --'}
              </option>
              {availableTopics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </header>

        {/* THÔNG BÁO LỖI */}
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 flex items-center gap-2 border-b border-red-100 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* MESSAGE LIST */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
               <Bot size={48} className="opacity-20" />
               <p>Hãy chọn chủ đề ở góc trên bên phải hoặc đính kèm tài liệu để bắt đầu!</p>
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

        {/* 🌟 CHAT INPUT FORM 🌟 */}
        <div className="p-4 bg-white border-t shrink-0 relative flex flex-col">
          
          {/* 🌟 GIAO DIỆN CHIP HIỂN THỊ FILE GIỐNG GEMINI */}
          {uploadingFile && (
            <div className="mb-3 flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 w-fit shadow-sm animate-in slide-in-from-bottom-2">
              <div className="p-1.5 bg-blue-100 rounded-lg text-blue-600">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700 max-w-[200px] truncate">
                  {uploadingFile.name}
                </span>
                <span className="text-xs text-gray-500">
                  Đang băm nhỏ & nạp vào VectorDB...
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="flex gap-2 items-center">
            
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.md,.txt,.py,.c,.cpp,.h,.asm,.yml,.yaml,.json"
              disabled={isFileUploading}
            />
            
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isFileUploading || isLoading}
              className="p-3 text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-xl transition-colors disabled:opacity-50"
              title="Tải tài liệu tri thức lên"
            >
              <Paperclip size={20} />
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedTopic ? `Hỏi AI về ${selectedTopic}...` : "Chọn bối cảnh hoặc tải file lên..."}
              disabled={isLoading || isFileUploading}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50 shadow-sm"
            />
            
            <button
              type="submit"
              disabled={isLoading || !input.trim() || isFileUploading}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0 shadow-sm"
            >
              Gửi
            </button>
          </form>
        </div>
        
      </div>
    </div>
  );
}