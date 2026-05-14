'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FileText, Search, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type SearchResults = {
  documents: Array<{ id: string; name: string; status?: string }>;
  users: Array<{ id: string; email: string; role?: string }>;
};

export default function AdminGlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>({ documents: [], users: [] });
  const [isSearching, setIsSearching] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const reset = () => {
    setResults({ documents: [], users: [] });
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
        const [docsRes, usersRes] = await Promise.all([
          apiClient.getIngestStatus(),
          apiClient.getUsers(),
        ]);
        const docs = (docsRes.data?.documents || []) as SearchResults['documents'];
        const users = (usersRes.data || []) as SearchResults['users'];
        const q = trimmed.toLowerCase();
        if (!cancelled) {
          setResults({
            documents: docs.filter((d) => d.name?.toLowerCase().includes(q)).slice(0, 5),
            users: users.filter((u) => u.email?.toLowerCase().includes(q)).slice(0, 5),
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

  const hasResults = results.documents.length > 0 || results.users.length > 0;

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          placeholder="Tìm kiếm tài liệu, người dùng..."
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
            <div className="p-4 text-center text-sm text-white/50">Không tìm thấy kết quả</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.documents.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider">Tài liệu</div>
                  {results.documents.map((doc) => (
                    <button key={doc.id} onClick={() => { router.push('/admin/documents'); setIsOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left transition-colors">
                      <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                        <p className="text-xs text-white/40">{doc.status || 'unknown'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.users.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider border-t border-white/10">Người dùng</div>
                  {results.users.map((user) => (
                    <button key={user.id} onClick={() => { router.push('/admin/users'); setIsOpen(false); setQuery(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left transition-colors">
                      <Users className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{user.email}</p>
                        <p className="text-xs text-white/40">{user.role || 'user'}</p>
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
