'use client';

import TextareaAutosize from 'react-textarea-autosize';
import { SendHorizontal } from 'lucide-react';
import DocumentPicker from './DocumentPicker'; 

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  
  // 🌟 THÊM CÁC PROPS MỚI: Để quản lý tài liệu đính kèm trực tiếp tại khung nhập liệu
  selectedDocIds: string[];
  onChangeDocIds: (ids: string[]) => void;
  currentTopic: string; // Phục vụ việc lọc tài liệu theo đúng chủ đề đoạn chat
}

export default function ChatInput({
  input = '',
  handleInputChange,
  handleSubmit,
  isLoading,
  selectedDocIds,
  onChangeDocIds,
  currentTopic,
}: ChatInputProps) {
  
  // Xử lý chặn hành động submit nếu cả chữ và file đều trống
  const isFormEmpty = !input.trim() && selectedDocIds.length === 0;

  return (
    <div className="w-full bg-zinc-950 border-t border-zinc-800 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isLoading || isFormEmpty) return;
          handleSubmit(e);
          // 🌟 LƯU Ý: Việc reset mảng selectedDocIds([]) về rỗng sẽ được xử lý 
          // ở hàm handleSubmit gốc của trang cha (page.tsx) sau khi gọi API thành công!
        }}
        className="max-w-4xl mx-auto w-full relative flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden p-3 shadow-2xl focus-within:border-zinc-700 transition-colors"
      >
        {/* 🌟 VÙNG 1: Đặt DocumentPicker nằm gọn gàng phía trên ô nhập liệu */}
        <div className="mb-2 px-1 flex items-center justify-between border-b border-zinc-800/50 pb-2">
          <DocumentPicker
            selectedIds={selectedDocIds}
            onChangeIds={onChangeDocIds}
            currentTopic={currentTopic}
          />
          {selectedDocIds.length > 0 && (
            <span className="text-[10px] font-mono text-zinc-500 animate-pulse">
              Đang đính kèm {selectedDocIds.length} tài liệu tham khảo
            </span>
          )}
        </div>

        {/* VÙNG 2: Khung chứa Textarea nhập liệu và Nút Gửi */}
        <div className="relative flex items-end w-full pl-1">
          <TextareaAutosize
            value={input}
            onChange={handleInputChange}
            placeholder="Hỏi bất cứ điều gì về tài liệu nội bộ..."
            className="w-full resize-none bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none pr-12 max-h-48 overflow-y-auto text-sm leading-6 py-1"
            minRows={1}
            onKeyDown={(e) => {
              // Bấm Enter để gửi (chỉ Shift+Enter mới xuống dòng)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading && !isFormEmpty) {
                  const form = e.currentTarget.form;
                  if (form) form.requestSubmit();
                }
              }
            }}
          />

          {/* Nút gửi tin nhắn */}
          <button
            type="submit"
            disabled={isLoading || isFormEmpty}
            className={`absolute right-1 bottom-1 p-1.5 rounded-xl transition-all ${
              isFormEmpty || isLoading
                ? 'text-zinc-700 cursor-not-allowed bg-transparent'
                : 'text-white bg-blue-600 hover:bg-blue-500 shadow-md'
            }`}
          >
            <SendHorizontal size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}