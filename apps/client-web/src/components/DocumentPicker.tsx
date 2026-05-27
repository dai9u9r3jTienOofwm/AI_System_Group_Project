'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Doc {
  id: string;
  name: string;
  status?: string;
  topic?: string;
  size?: number;
  created_at?: string;
}

interface DocumentPickerProps {
  selectedIds: string[];
  onChangeIds: (ids: string[]) => void;
  currentTopic: string;
}

type UploadResponse = {
  success?: boolean;
  id?: string;
  document_id?: string;
  filename?: string;
  name?: string;
  status?: string;
  size?: number;
  error?: string;
  detail?: string;
  message?: string;
  data?: {
    id?: string;
    document_id?: string;
    filename?: string;
    name?: string;
    status?: string;
    size?: number;
  };
};

const ACCEPTED_FILE_TYPES = [
  '.pdf',
  '.md',
  '.txt',
  '.py',
  '.c',
  '.cpp',
  '.h',
  '.asm',
  '.yml',
  '.yaml',
  '.json',
].join(',');

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function asString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '';
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeDoc(raw: unknown): Doc | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;
  const id = asString(obj.id) || asString(obj.document_id) || asString(obj._id);

  if (!id) return null;

  const name =
    asString(obj.name) ||
    asString(obj.filename) ||
    asString(obj.original_filename) ||
    'Tài liệu chưa đặt tên';

  return {
    id,
    name,
    status: asString(obj.status) || undefined,
    topic: asString(obj.topic) || undefined,
    size:
      asNumber(obj.size) ??
      asNumber(obj.file_size) ??
      asNumber(obj.size_bytes),
    created_at: asString(obj.created_at) || asString(obj.createdAt) || undefined,
  };
}

function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
}

function statusLabel(status?: string): string {
  if (!status) return 'ready';

  const normalized = status.toLowerCase();

  if (normalized === 'completed' || normalized === 'indexed') return 'ready';
  if (normalized === 'processing' || normalized === 'queued') return 'processing';
  if (normalized === 'failed') return 'failed';

  return status;
}

function statusClassName(status?: string): string {
  const normalized = statusLabel(status);

  if (normalized === 'ready') {
    return 'bg-green-500/15 text-green-600 border-green-500/20';
  }

  if (normalized === 'processing') {
    return 'bg-yellow-500/15 text-yellow-600 border-yellow-500/20';
  }

  if (normalized === 'failed') {
    return 'bg-red-500/15 text-red-600 border-red-500/20';
  }

  return 'bg-surface-variant text-text-secondary border-border-gray';
}

export default function DocumentPicker({
  selectedIds,
  onChangeIds,
  currentTopic,
}: DocumentPickerProps) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<'success' | 'error' | 'info'>('info');

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotice(message);
      setNoticeType(type);

      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }

      noticeTimerRef.current = window.setTimeout(() => {
        setNotice(null);
        noticeTimerRef.current = null;
      }, 3500);
    },
    [],
  );

  const fetchDocs = useCallback(async () => {
    if (!currentTopic) {
      setDocs([]);
      return;
    }

    const userId = localStorage.getItem('userId') || 'guest';
    const params = new URLSearchParams({
      topic: currentTopic,
      user_id: userId,
    });

    setLoading(true);

    try {
      const res = await fetch(`/api/documents?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Không thể tải danh sách tài liệu.');
      }

      const data = await res.json();
      const rawDocs = Array.isArray(data)
        ? data
        : data && Array.isArray(data.documents)
          ? data.documents
          : [];

      const normalizedDocs: Doc[] = rawDocs
      .map((rawDoc: unknown): Doc | null => normalizeDoc(rawDoc))
      .filter((doc: Doc | null): doc is Doc => Boolean(doc));

    setDocs(normalizedDocs);
    } catch (err) {
      console.error('Lỗi lấy tài liệu tham khảo:', err);
      setDocs([]);
      showNotice('Không thể tải danh sách tài liệu.', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentTopic, showNotice]);

  const selectedDocs = useMemo(() => {
    const docsById = new Map(docs.map((doc) => [doc.id, doc]));

    return selectedIds.map(
      (id) =>
        docsById.get(id) ?? {
          id,
          name: 'Tài liệu đã đính kèm',
          status: 'selected',
        },
    );
  }, [docs, selectedIds]);

  const mergeDoc = useCallback((doc: Doc) => {
    setDocs((prev) => {
      const exists = prev.some((item) => item.id === doc.id);
      if (exists) {
        return prev.map((item) => (item.id === doc.id ? { ...item, ...doc } : item));
      }
      return [doc, ...prev];
    });
  }, []);

  const attachDoc = useCallback(
    (id: string) => {
      onChangeIds(Array.from(new Set([...selectedIds, id])));
    },
    [onChangeIds, selectedIds],
  );

  const detachDoc = useCallback(
    (id: string) => {
      onChangeIds(selectedIds.filter((selectedId) => selectedId !== id));
    },
    [onChangeIds, selectedIds],
  );

  const toggleDoc = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        detachDoc(id);
      } else {
        attachDoc(id);
      }
    },
    [attachDoc, detachDoc, selectedIds],
  );

  const togglePicker = async () => {
    if (!currentTopic) {
      showNotice('Vui lòng chọn chủ đề trước khi chọn tài liệu.', 'error');
      return;
    }

    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      await fetchDocs();
    }
  };

  const openFilePicker = () => {
    if (!currentTopic) {
      showNotice('Vui lòng chọn chủ đề trước khi tải tài liệu.', 'error');
      return;
    }

    if (isUploading) return;

    fileInputRef.current?.click();
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!currentTopic) {
      showNotice('Vui lòng chọn chủ đề trước khi tải tài liệu.', 'error');
      resetFileInput();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showNotice('Tệp quá lớn. Vui lòng chọn tệp dưới 10MB.', 'error');
      resetFileInput();
      return;
    }

    const userId = localStorage.getItem('userId') || 'guest';
    const formData = new FormData();

    formData.append('file', file);
    formData.append('topic', currentTopic);
    formData.append('user_id', userId);

    setIsUploading(true);
    showNotice(`Đang tải lên ${file.name}...`, 'info');

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = (await res.json().catch(() => ({}))) as UploadResponse;

      if (!res.ok) {
        throw new Error(
          result.error ||
            result.detail ||
            result.message ||
            'Upload tài liệu thất bại.',
        );
      }

      const uploadedDoc = normalizeDoc(result.data ?? result);
      const uploadedId =
        uploadedDoc?.id ||
        result.document_id ||
        result.id ||
        result.data?.document_id ||
        result.data?.id;

      if (!uploadedId) {
        throw new Error('Backend đã upload xong nhưng không trả về document_id.');
      }

      const doc: Doc = uploadedDoc ?? {
        id: uploadedId,
        name:
          result.filename ||
          result.name ||
          result.data?.filename ||
          result.data?.name ||
          file.name,
        status: result.status || result.data?.status || 'processing',
        topic: currentTopic,
        size: result.size || result.data?.size || file.size,
      };

      mergeDoc(doc);
      attachDoc(doc.id);
      setOpen(false);
      showNotice(`Đã đính kèm ${doc.name}.`, 'success');
    } catch (err) {
      console.error('Lỗi khi tải file lên:', err);
      showNotice(
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi tải tài liệu lên.',
        'error',
      );
    } finally {
      setIsUploading(false);
      resetFileInput();
    }
  };

  useEffect(() => {
    setOpen(false);
    setDocs([]);
    setNotice(null);
  }, [currentTopic]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handler);
    }

    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleUpload}
        className="hidden"
      />

      {selectedDocs.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {selectedDocs.map((doc) => (
            <span
              key={doc.id}
              className="group inline-flex max-w-[240px] items-center gap-2 rounded-2xl border border-border-gray bg-input-surface px-3 py-1.5 text-sm text-text-emphasis shadow-sm"
              title={doc.name}
            >
              <span className="material-symbols-outlined text-[17px] text-text-secondary">
                description
              </span>
              <span className="truncate">{doc.name}</span>
              <button
                type="button"
                onClick={() => detachDoc(doc.id)}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-variant hover:text-negative"
                aria-label={`Bỏ đính kèm ${doc.name}`}
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={() => onChangeIds([])}
            className="rounded-full px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-variant hover:text-negative"
          >
            Xóa hết
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isUploading}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border-gray bg-input-surface px-3 text-sm text-text-emphasis shadow-sm transition-colors hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
          title={!currentTopic ? 'Vui lòng chọn chủ đề trước khi tải tài liệu.' : 'Tải lên và đính kèm tài liệu'}
        >
          <span
            className={`material-symbols-outlined text-[18px] text-text-secondary ${
              isUploading ? 'animate-spin' : ''
            }`}
          >
            {isUploading ? 'progress_activity' : 'attach_file'}
          </span>
          <span>{isUploading ? 'Đang tải...' : 'Đính kèm'}</span>
        </button>

        <button
          type="button"
          onClick={togglePicker}
          className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm shadow-sm transition-colors ${
            selectedIds.length > 0
              ? 'border-primary bg-primary-container/10 text-primary'
              : 'border-border-gray bg-input-surface text-text-emphasis hover:bg-surface-variant'
          }`}
          title={!currentTopic ? 'Vui lòng chọn chủ đề trước khi chọn tài liệu.' : 'Chọn tài liệu đã tải lên'}
        >
          <span className="material-symbols-outlined text-[18px] text-text-secondary">
            folder_open
          </span>
          <span>Tài liệu đã có</span>
          {selectedIds.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">
              {selectedIds.length}
            </span>
          )}
        </button>

        {notice && (
          <span
            className={`text-xs ${
              noticeType === 'success'
                ? 'text-green-600'
                : noticeType === 'error'
                  ? 'text-red-500'
                  : 'text-text-secondary'
            }`}
          >
            {notice}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-3 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-gray bg-surface-container shadow-dialog">
          <div className="flex items-center justify-between border-b border-border-gray px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text-emphasis">
                Tài liệu trong chủ đề
              </p>
              <p className="mt-0.5 max-w-[280px] truncate text-xs text-text-secondary">
                {currentTopic || 'Chưa chọn chủ đề'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-variant hover:text-text-emphasis"
              aria-label="Đóng danh sách tài liệu"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {!currentTopic ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-sm text-text-secondary">
                <span className="material-symbols-outlined mb-2 text-[32px] opacity-60">
                  topic
                </span>
                Chọn một chủ đề trước khi chọn tài liệu.
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-sm text-text-secondary">
                <span className="material-symbols-outlined mb-2 animate-spin text-[28px]">
                  progress_activity
                </span>
                Đang tải danh sách tài liệu...
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center text-sm text-text-secondary">
                <span className="material-symbols-outlined mb-2 text-[32px] opacity-60">
                  note_stack
                </span>
                <span>Chưa có tài liệu nào trong chủ đề này.</span>
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="mt-3 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-fixed"
                >
                  Tải tài liệu đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {docs.map((doc) => {
                  const checked = selectedIds.includes(doc.id);
                  const sizeText = formatSize(doc.size);
                  const label = statusLabel(doc.status);

                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDoc(doc.id)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        checked
                          ? 'bg-primary-container/15'
                          : 'hover:bg-surface-variant'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          checked
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-border-light text-transparent'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          check
                        </span>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-emphasis">
                          {doc.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                          {sizeText && <span>{sizeText}</span>}
                          <span className={`rounded-full border px-2 py-0.5 ${statusClassName(doc.status)}`}>
                            {label}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {docs.length > 0 && (
            <div className="flex items-center justify-between border-t border-border-gray px-4 py-3">
              <span className="text-xs text-text-secondary">
                Đã chọn {selectedIds.length}/{docs.length}
              </span>

              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChangeIds([])}
                    className="rounded-full px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-variant hover:text-negative"
                  >
                    Bỏ chọn
                  </button>
                )}

                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={isUploading}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-60"
                >
                  Tải lên
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
