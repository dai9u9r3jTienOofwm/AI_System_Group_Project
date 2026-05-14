"use client";

import React, { useEffect, useRef, useState } from 'react';
import { FileText, Search, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

type SearchResults = {
  documents: Array<{ id: string; name: string; status?: string }>;
  users: Array<{ id: string; email: string; role?: string }>;
};

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>({
    documents: [],
    users: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const resetResults = () => {
    setResults({ documents: [], users: [] });
    setIsSearching(false);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [docsResponse, usersResponse] = await Promise.all([
          apiClient.getIngestStatus(),
          apiClient.getUsers(),
        ]);

        const documents = (docsResponse.data?.documents || []) as SearchResults['documents'];
        const users = (usersResponse.data || []) as SearchResults['users'];
        const q = trimmed.toLowerCase();

        if (!isCancelled) {
          setResults({
            documents: documents
              .filter((doc) => doc.name?.toLowerCase().includes(q))
              .slice(0, 5),
            users: users
              .filter((user) => user.email?.toLowerCase().includes(q))
              .slice(0, 5),
          });
        }
      } catch {
        if (!isCancelled) {
          resetResults();
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  const hasResults = results.documents.length > 0 || results.users.length > 0;

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Tìm kiếm tài liệu, người dùng, chat..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            if (!nextValue.trim()) {
              resetResults();
              setIsOpen(false);
              return;
            }
            setIsOpen(true);
          }}
          onFocus={() => query && setIsOpen(true)}
          className="pl-10 pr-8 bg-secondary/50 border-border/50 h-9 text-sm placeholder:text-muted-foreground/60"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              resetResults();
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {isOpen && query && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden z-50">
          {isSearching ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Đang tìm kiếm...</div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Không tìm thấy kết quả</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.documents.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tài liệu</div>
                  {results.documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        router.push('/dashboard/documents');
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                    >
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.status || 'unknown'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {results.users.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t border-border">Người dùng</div>
                  {results.users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        router.push('/dashboard/users');
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                    >
                      <Users className="h-4 w-4 text-chart-2 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.role || 'user'}</p>
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