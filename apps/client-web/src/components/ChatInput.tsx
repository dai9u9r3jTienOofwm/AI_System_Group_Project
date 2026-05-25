import TextareaAutosize from 'react-textarea-autosize';

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
      className="relative w-full shadow-dialog rounded-full flex items-center"
    >
      <TextareaAutosize
        value={input}
        onChange={handleInputChange}
        placeholder="Hỏi bất cứ điều gì về tài liệu nội bộ..."
        className="w-full bg-input-surface text-text-emphasis text-body-base font-body-base rounded-[24px] py-4 pl-6 pr-16 focus:outline-none focus:ring-0 placeholder:text-text-secondary shadow-inset-input resize-none max-h-48 overflow-y-auto"
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
        className={`absolute right-2 bottom-2 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 shadow-floating ${
          isLoading || !input.trim()
            ? 'bg-surface-container-high text-text-secondary cursor-not-allowed'
            : 'bg-primary-container text-black hover:scale-105 active:scale-95 cursor-pointer'
        }`}
        aria-label="Gửi tin nhắn"
      >
        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>send</span>
      </button>
    </form>
  );
}
