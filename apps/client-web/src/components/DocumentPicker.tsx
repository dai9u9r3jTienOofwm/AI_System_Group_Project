'use client';

import { useState, useEffect, useRef } from 'react';
import { Paperclip, X, FileText, RefreshCw, ChevronDown } from 'lucide-react';

interface Doc {
  id: string;
  fileName: string;
  status?: string;
}

interface DocumentPickerProps {
  selectedIds: string[];
  onChangeIds: (ids: string[]) => void;
}

export default function DocumentPicker({ selectedIds, onChangeIds }: DocumentPickerProps) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchDocs = async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/documents');
      const data = await res.json();
      setDocs(data.documents ?? []);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    fetchDocs();
  };

  const toggle = (id: string) => {
    onChangeIds(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedDocs = docs.filter(d => selectedIds.includes(d.id));

  return (
    <div ref={containerRef} className="relative">
      {/* Selected doc chips */}
      {selectedDocs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedDocs.map(doc => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-2 py-0.5 rounded-full"
            >
              <FileText size={11} />
              <span className="max-w-[140px] truncate">{doc.fileName}</span>
              <button
                onClick={() => toggle(doc.id)}
                className="hover:text-red-600 ml-0.5 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            onClick={() => onChangeIds([])}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Xóa hết
          </button>
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          selectedIds.length > 0
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'
        }`}
      >
        <Paperclip size={12} />
        Tài liệu tham khảo
        {selectedIds.length > 0 && (
          <span className="bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
            {selectedIds.length}
          </span>
        )}
        <ChevronDown size={12} className="opacity-50" />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-10">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Chọn tài liệu tham khảo</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <RefreshCw size={18} className="animate-spin mx-auto mb-2" />
                Đang tải danh sách tài liệu...
              </div>
            ) : docs.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <FileText size={24} className="mx-auto mb-2 opacity-30" />
                Chưa có tài liệu nào trong hệ thống.
                <br />
                <span className="text-xs">Admin cần tải lên tài liệu trước.</span>
              </div>
            ) : (
              docs.map(doc => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(doc.id)}
                    onChange={() => toggle(doc.id)}
                    className="rounded accent-blue-600 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{doc.fileName}</p>
                    {doc.status && (
                      <p className="text-xs text-gray-400 capitalize">{doc.status}</p>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          {!loading && docs.length > 0 && selectedIds.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Đã chọn {selectedIds.length}/{docs.length}
              </span>
              <button
                onClick={() => onChangeIds([])}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
