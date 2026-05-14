import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, BookOpen, Copy, Check } from 'lucide-react';

interface MessageProps {
  role: string;
  content: string;
  sources?: { fileName: string; pageNumber?: number; snippet?: string }[];
}

export default function MessageItem({ role, content, sources }: MessageProps) {
  const isUser = role === 'user';
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={`flex w-full p-4 ${isUser ? 'bg-gray-950' : 'bg-gray-900'}`}>
      <div className="flex max-w-4xl mx-auto w-full gap-4">
        <div className="w-8 h-8 flex items-center justify-center rounded-sm bg-gray-700 shrink-0">
          {isUser ? <User size={20} /> : <Bot size={20} className="text-blue-600" />}
        </div>

        <div className="prose prose-invert max-w-none flex-1 relative group">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-md"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-gray-700 text-red-400 px-1 py-0.5 rounded" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>

          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute top-0 right-0 p-2 text-gray-400 bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700 hover:text-gray-200"
              title="Copy nội dung"
              aria-label="Copy nội dung"
            >
              {isCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          )}

          {!isUser && sources && sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-2">
                <BookOpen size={16} /> Nguồn tài liệu:
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-900/40 border border-blue-700/40 rounded text-xs text-blue-300 hover:bg-blue-800/40 transition-colors cursor-default"
                    title={source.snippet}
                  >
                    <span className="font-bold">[{index + 1}]</span>
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
