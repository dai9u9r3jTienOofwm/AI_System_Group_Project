import TextareaAutosize from 'react-textarea-autosize';
import { SendHorizontal } from 'lucide-react';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: { preventDefault(): void }) => void;
  isLoading: boolean;
}

export default function ChatInput({
  input = '',
  handleInputChange,
  handleSubmit,
  isLoading,
}: ChatInputProps) {
  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-4xl mx-auto w-full relative flex items-end p-4 bg-gray-800 border border-gray-700 rounded-xl"
    >
      <TextareaAutosize
        value={input}
        onChange={handleInputChange}
        placeholder="Hỏi bất cứ điều gì về tài liệu nội bộ..."
        className="w-full resize-none bg-transparent text-gray-100 placeholder:text-gray-500 focus:outline-none pr-12 max-h-48 overflow-y-auto"
        minRows={1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
              handleSubmit(e);
            }
          }
        }}
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="absolute bottom-4 right-4 text-blue-600 disabled:text-gray-300 transition-colors"
        aria-label="Gửi tin nhắn"
      >
        <SendHorizontal size={24} />
      </button>
    </form>
  );
}
