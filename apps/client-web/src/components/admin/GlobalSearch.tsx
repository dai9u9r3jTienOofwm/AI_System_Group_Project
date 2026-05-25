'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FileText, Search, X } from 'lucide-react'; // Đã xóa icon Users
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type SearchResults = {
  // Dự phòng cả name và filename tùy thuộc vào Backend Python đang trả về tên trường nào
  documents: Array<{ id: string; name?: string; filename?: string; status?: string }>;
};

export default function ClientGlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>({ documents: [] });
  const [isSearching, setIsSearching] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const reset = () => {
    setResults({ documents: [] });
    setIsSearching(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        // 1. ĐÃ SỬA: Chỉ gọi duy nhất API lấy tài liệu, không gọi API Users nữa
        const docsRes = await apiClient.getIngestStatus();
        const docs = (docsRes?.documents || []) as SearchResults['documents'];
        const q = trimmed.toLowerCase();
        
        if (!cancelled) {
          setResults({
            // Tìm kiếm dựa trên trường name hoặc filename
            documents: docs.filter((d) => (d.name || d.filename || '').toLowerCase().includes(q)).slice(0, 5),
          });
        }
      } catch {
        if (!cancelled) reset();
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const hasResults = results.documents.length > 0;

  return (
    <div ref={ref} className="relative w-full max-w-[448px]">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          placeholder="Tìm kiếm tài liệu RAG của bạn..."
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (!v.trim()) { reset(); setIsOpen(false); return; }
            setIsOpen(true);
          }}
          onFocus={() => query && setIsOpen(true)}
          className="w-full pl-10 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
        {query && (
          <button onClick={() => { setQuery(''); reset(); setIsOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-white/40 hover:text-white" />
          </button>
        )}
      </div>

      {isOpen && query && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          {isSearching ? (
            <div className="p-4 text-center text-sm text-white/50">Đang tìm kiếm...</div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-sm text-white/50">Không tìm thấy tài liệu nào</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.documents.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">Tài Liệu Của Bạn</div>
                  {results.documents.map((doc) => (
                    // 2. ĐÃ SỬA: Route chuyển hướng từ /admin/documents sang /documents (hoặc route tương ứng bên client)
                    <button key={doc.id} onClick={() => { router.push('/documents'); setIsOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left transition-colors">
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{doc.name || doc.filename}</p>
                        <p className="text-xs text-white/40">{doc.status || 'Đã tải lên'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}