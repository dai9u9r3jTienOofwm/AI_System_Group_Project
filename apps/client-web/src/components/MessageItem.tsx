import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, BookOpen, Copy, Check } from 'lucide-react';

import type { Message } from '@/hooks/useConversations';

interface MessageProps {
  message: Message;
}

export default function MessageItem({ message }: MessageProps) {
  const { role, content, sources } = message;
  
  const isUser = role === 'user';
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    // 🌟 SỬA NỀN: Người dùng nền xám cực nhạt (bg-gray-50), AI nền trắng (bg-white) có viền mỏng
    <div className={`flex w-full p-4 md:p-6 ${isUser ? 'bg-gray-50' : 'bg-white border-y border-gray-100'}`}>
      <div className="flex max-w-4xl mx-auto w-full gap-4">
        
        {/* 🌟 SỬA AVATAR: Nền avatar sáng sủa hơn */}
        <div className={`w-8 h-8 flex items-center justify-center rounded-md shrink-0 ${isUser ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-600'}`}>
          {isUser ? <User size={20} /> : <Bot size={20} />}
        </div>

        {/* 🌟 SỬA TEXT: Xóa prose-invert để chữ thành màu đen/xám đậm mặc định, thêm text-gray-900 */}
        <div className="prose max-w-none flex-1 relative group text-gray-900">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus as any} // Vẫn giữ nền tối cho block code để dễ nhìn cú pháp
                    language={match[1]}
                    PreTag="div"
                    className="rounded-md shadow-sm border border-gray-800"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  // 🌟 SỬA CODE INLINE: Nền xám nhạt chữ hồng/đỏ
                  <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded font-mono text-sm border border-gray-200" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>

          {!isUser && (
            // 🌟 SỬA NÚT COPY: Nền xám nhạt, icon xám đậm
            <button
              onClick={handleCopy}
              className="absolute -top-2 -right-2 p-2 text-gray-500 bg-white border border-gray-200 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-50 hover:text-gray-800 shadow-sm"
              title="Copy nội dung"
              aria-label="Copy nội dung"
            >
              {isCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          )}

          {/* 🌟 HIỂN THỊ NGUỒN TÀI LIỆU TRÍCH DẪN SÁNG MÀU HƠN */}
          {!isUser && sources && sources.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-3">
                <BookOpen size={16} /> Nguồn tài liệu tham khảo:
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map((source: any, index: number) => (
                  <div
                    key={index}
                    // Sửa pill hiển thị nguồn sang màu xanh dương nhạt cho hợp tông Light Mode
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700 hover:bg-blue-100 transition-colors cursor-default shadow-sm"
                    title={source.snippet}
                  >
                    <span className="font-bold text-blue-800">[{index + 1}]</span>
                    <span className="font-medium">{source.fileName || "Tài liệu"}</span>
                    {source.pageNumber && <span className="opacity-70 text-blue-600">(Trang {source.pageNumber})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}