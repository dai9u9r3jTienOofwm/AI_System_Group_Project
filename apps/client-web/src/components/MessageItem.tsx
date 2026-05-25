import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
    <div className={`flex w-full py-6 px-4 rounded-xl mb-4 transition-colors ${isUser ? 'bg-transparent' : 'bg-surface-container shadow-floating'}`}>
      <div className="flex w-full gap-4">
        {isUser ? (
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-bright shrink-0 text-text-secondary">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>person</span>
          </div>
        ) : (
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-container shrink-0 text-on-primary-container">
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>robot_2</span>
          </div>
        )}

        <div className="prose prose-invert max-w-none flex-1 relative group font-body-base text-text-emphasis leading-relaxed">
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
                    className="rounded-md !bg-surface-container-highest !my-4"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-surface-container-highest text-primary-fixed px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                );
              },
              p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
              a: ({children, href}) => <a href={href} className="text-primary hover:underline">{children}</a>,
              strong: ({children}) => <strong className="font-body-bold text-white">{children}</strong>,
            }}
          >
            {content}
          </ReactMarkdown>

          {!isUser && (
            // 🌟 SỬA NÚT COPY: Nền xám nhạt, icon xám đậm
            <button
              onClick={handleCopy}
              className="absolute -top-2 right-0 p-2 text-text-secondary bg-surface-bright rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-surface-container-highest hover:text-white shadow-floating scale-95 hover:scale-100"
              title="Copy nội dung"
              aria-label="Copy nội dung"
            >
              <span className="material-symbols-outlined text-[16px]">{isCopied ? 'check' : 'content_copy'}</span>
            </button>
          )}

          {/* 🌟 HIỂN THỊ NGUỒN TÀI LIỆU TRÍCH DẪN SÁNG MÀU HƠN */}
          {!isUser && sources && sources.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border-gray/50">
              <p className="flex items-center gap-2 text-sm font-small-bold text-text-secondary mb-3 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">menu_book</span> Nguồn tài liệu:
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map((source: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-variant/50 border border-border-gray rounded-md text-xs text-text-secondary hover:bg-surface-variant hover:text-text-emphasis transition-colors cursor-default"
                    title={source.snippet}
                  >
                    <span className="font-body-bold text-primary-fixed-dim">[{index + 1}]</span>
                    <span>{source.fileName}</span>
                    {source.pageNumber && <span className="opacity-70">(Trang {source.pageNumber})</span>}
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