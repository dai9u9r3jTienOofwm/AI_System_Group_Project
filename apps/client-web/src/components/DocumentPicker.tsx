'use client';

import { useState, useEffect, useRef } from 'react';

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
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocs(data.documents ?? []);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  const handleToggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
      fetchDocs();
    }
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
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedDocs.map(doc => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 bg-surface-container border border-border-light text-text-emphasis text-small-base font-small-base px-3 py-1 rounded-full shadow-floating"
            >
              <span className="material-symbols-outlined text-[14px] text-text-secondary">description</span>
              <span className="max-w-[140px] truncate">{doc.fileName}</span>
              <button
                onClick={() => toggle(doc.id)}
                className="hover:text-negative ml-1 transition-colors flex items-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
          <button
            onClick={() => onChangeIds([])}
            className="text-xs text-text-secondary hover:text-negative transition-colors ml-1 font-nav-link-inactive cursor-pointer"
          >
            Xóa hết
          </button>
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={handleToggle}
        className={`bg-input-surface text-text-emphasis font-nav-link-inactive rounded-full py-1.5 px-4 flex items-center gap-2 border hover:bg-[#282828] transition-colors shadow-floating cursor-pointer ${
          selectedIds.length > 0 ? 'border-primary text-primary' : 'border-border-gray'
        }`}
      >
        <span className="material-symbols-outlined text-[18px] text-text-secondary">attach_file</span>
        Tài liệu tham khảo
        {selectedIds.length > 0 && (
          <span className="bg-primary-container text-black text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none ml-1">
            {selectedIds.length}
          </span>
        )}
        <span className="material-symbols-outlined text-[18px] text-text-secondary ml-1">expand_more</span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute bottom-full left-0 mb-3 w-80 bg-surface-container border border-border-gray rounded-xl shadow-dialog z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gray flex items-center justify-between bg-panel-surface">
            <span className="text-sm font-body-bold text-text-emphasis">Chọn tài liệu tham khảo</span>
            <button
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-text-emphasis transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto bg-surface-container">
            {loading ? (
              <div className="p-6 text-center text-text-secondary text-sm flex flex-col items-center">
                <span className="material-symbols-outlined text-[24px] animate-spin mb-2">refresh</span>
                Đang tải danh sách tài liệu...
              </div>
            ) : docs.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm flex flex-col items-center">
                <span className="material-symbols-outlined text-[32px] mb-2 opacity-50">description</span>
                Chưa có tài liệu nào trong hệ thống.
                <br />
                <span className="text-xs mt-1">Admin cần tải lên tài liệu trước.</span>
              </div>
            ) : (
              docs.map(doc => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-variant cursor-pointer transition-colors border-b border-border-gray/30 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(doc.id)}
                    onChange={() => toggle(doc.id)}
                    className="rounded bg-background border-border-light checked:bg-primary-container accent-primary-container shrink-0 w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body-base text-text-emphasis truncate">{doc.fileName}</p>
                    {doc.status && (
                      <p className="text-xs text-text-secondary capitalize">{doc.status}</p>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          {!loading && docs.length > 0 && selectedIds.length > 0 && (
            <div className="px-4 py-3 border-t border-border-gray flex justify-between items-center bg-panel-surface">
              <span className="text-xs text-text-secondary font-small-base">
                Đã chọn {selectedIds.length}/{docs.length}
              </span>
              <button
                onClick={() => onChangeIds([])}
                className="text-xs text-negative hover:text-error transition-colors font-small-bold cursor-pointer"
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
