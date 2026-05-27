'use client';

import { useState } from 'react';

export interface Source {
  document_id: string;
  filename: string;
  chunk_index: number;
  preview?: string;
  preview_text?: string;
  content?: string;
  full_content?: string;
  content_url?: string;
  chunk_url?: string;
}

interface SourceCitationProps {
  sources?: Source[] | null;
}

interface ChunkPreviewResponse {
  document_id?: string;
  filename?: string;
  chunk_index?: number;
  content?: string;
  text?: string;
  preview?: string;
  full_content?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  detail?: string;
  message?: string;
}

interface ExpandedChunk {
  key: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
}
const getAuthHeaders = (): HeadersInit => {
  if (typeof window === 'undefined') return {};

  const userId = window.localStorage.getItem('userId');

  return userId
    ? { 'x-user-id': userId }
    : {};
};
const resolveApiUrl = (url: string | undefined, fallback: string) => {
  const target = (url || fallback).trim();

  if (!target) return fallback;

  if (target.startsWith('http://') || target.startsWith('https://')) {
    return target;
  }

  // Frontend proxy hiện tại của bạn là:
  // /api/documents/[document_id]/chunk-preview
  // /api/documents/[document_id]/content
  if (target.startsWith('/api/documents/')) {
    return target;
  }

  // Nếu backend hoặc file cũ trả /api/v1/documents/... thì bỏ /v1.
  if (target.startsWith('/api/v1/documents/')) {
    return target.replace('/api/v1/documents/', '/api/documents/');
  }

  // Nếu backend trả route thật của FastAPI: /v1/documents/...
  // thì chuyển sang Next.js frontend proxy: /api/documents/...
  if (target.startsWith('/v1/documents/')) {
    return target.replace('/v1/documents/', '/api/documents/');
  }

  if (target.startsWith('/api/')) {
    return target;
  }

  return target.startsWith('/') ? target : `/${target}`;
};
function getSourceKey(source: Source): string {
  return `${source.document_id}:${source.chunk_index}`;
}

function getPreviewText(source: Source): string {
  return (
    source.preview ||
    source.preview_text ||
    source.content ||
    source.full_content ||
    ''
  );
}

function getFilenameFromDisposition(
  contentDisposition: string | null,
  fallback: string,
): string {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8FilenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8FilenameMatch?.[1]) {
    try {
      return decodeURIComponent(utf8FilenameMatch[1]);
    } catch {
      return utf8FilenameMatch[1];
    }
  }

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  return fallback;
}

export default function SourceCitation({ sources }: SourceCitationProps) {
  const safeSources = Array.isArray(sources) ? sources : [];

  const [expandedChunk, setExpandedChunk] = useState<ExpandedChunk | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (safeSources.length === 0) {
    return null;
  }

  const fetchChunkContent = async (source: Source) => {
    const key = getSourceKey(source);

    if (expandedChunk?.key === key) {
      setExpandedChunk(null);
      return;
    }

    setLoadingKey(key);
    setError(null);

    try {
      const fallbackUrl =
        `/api/documents/${encodeURIComponent(source.document_id)}` +
        `/chunk-preview?chunk_index=${encodeURIComponent(String(source.chunk_index))}`;

      const url = resolveApiUrl(source.chunk_url, fallbackUrl);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
    });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let message = `Không thể tải nội dung chunk (${response.status}).`;

        if (contentType.includes('application/json')) {
          const errorBody = (await response.json().catch(() => null)) as
            | ChunkPreviewResponse
            | null;
          message =
            errorBody?.detail ||
            errorBody?.error ||
            errorBody?.message ||
            message;
        }

        throw new Error(message);
      }

      let data: ChunkPreviewResponse;

      if (contentType.includes('application/json')) {
        data = (await response.json()) as ChunkPreviewResponse;
      } else {
        data = {
          content: await response.text(),
        };
      }

      const content =
        data.content ||
        data.full_content ||
        data.text ||
        data.preview ||
        getPreviewText(source);

      setExpandedChunk({
        key,
        documentId: data.document_id || source.document_id,
        filename: data.filename || source.filename || 'unknown',
        chunkIndex:
          typeof data.chunk_index === 'number'
            ? data.chunk_index
            : source.chunk_index,
        content,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
      console.error('Error fetching chunk:', err);
    } finally {
      setLoadingKey(null);
    }
  };

  const downloadFile = async (source: Source) => {
    const key = getSourceKey(source);
    setLoadingKey(key);
    setError(null);

    try {
      const fallbackUrl =
        `/api/documents/${encodeURIComponent(source.document_id)}/content`;

      const url = resolveApiUrl(source.content_url, fallbackUrl);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
        });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }

        if (response.status === 403) {
          throw new Error('Bạn không có quyền tải tài liệu này.');
        }

        throw new Error(`Không thể tải file (${response.status}).`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const filename = getFilenameFromDisposition(
        response.headers.get('content-disposition'),
        source.filename || 'document',
      );

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
      console.error('Error downloading file:', err);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl bg-[#1f1f1f] p-4 text-sm text-gray-100">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
        <span aria-hidden="true">📖</span>
        <span>Nguồn tài liệu ({safeSources.length})</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {safeSources.map((source, index) => {
          const key = getSourceKey(source);
          const preview = getPreviewText(source);
          const isLoading = loadingKey === key;
          const isExpanded = expandedChunk?.key === key;

          return (
            <div
              key={`${key}:${index}`}
              className="rounded-lg border border-gray-700 bg-[#252525] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-green-400">
                      [{index + 1}]
                    </span>
                    <span aria-hidden="true" className="text-gray-300">
                      📄
                    </span>
                    <span className="truncate font-semibold text-white">
                      {source.filename || 'unknown'}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-gray-400">
                    Chunk #{source.chunk_index}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchChunkContent(source)}
                    disabled={isLoading}
                    className="rounded-md bg-green-500 px-2.5 py-1 text-xs font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading && !isExpanded ? 'Loading...' : isExpanded ? 'Hide' : 'View'}
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadFile(source)}
                    disabled={isLoading}
                    className="rounded-md bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Download
                  </button>
                </div>
              </div>

              {preview && !isExpanded && (
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs italic leading-relaxed text-gray-300">
                  {preview}
                </p>
              )}

              {isExpanded && expandedChunk && (
                <div className="mt-3 rounded-lg border border-gray-700 bg-[#111] p-3">
                  <div className="mb-2 text-xs font-semibold text-gray-400">
                    Nội dung chunk được AI sử dụng
                  </div>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-100">
                    {expandedChunk.content}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs italic text-gray-400">
        💡 Tip: Click “View” để xem đúng chunk AI đã dùng. Click “Download” để tải file gốc.
      </p>
    </div>
  );
}
