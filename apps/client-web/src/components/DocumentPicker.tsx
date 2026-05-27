'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

export default function DocumentPicker({ selectedIds, onChangeIds, currentTopic }: DocumentPickerProps) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  
  // State quản lý luồng Upload cục bộ trong Popover
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🌟 1. FIX LINTER + BẢO MẬT: Bọc useCallback và nhét thêm user_id để không đọc trộm file
  const fetchDocs = useCallback(async () => {
    if (!currentTopic) return;
    const userId = localStorage.getItem('userId') || 'guest';
    setLoading(true);
    
    try {
      // ✅ Gửi user_id để backend filter documents theo quyền
      const params = new URLSearchParams({
        topic: currentTopic,
        user_id: userId
      });
      const res = await fetch(`/api/documents?${params.toString()}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setDocs(data);
      } else if (data && Array.isArray(data.documents)) {
        setDocs(data.documents);
      } else {
        setDocs([]);
      }
    } catch (err) {
      console.error('Lỗi lấy tài liệu tham khảo:', err);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [currentTopic]);

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

  // 🌟 2. KHÔI PHỤC HÀM UPLOAD: Có gửi kèm Căn cước (user_id) và thanh tiến độ
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentTopic) {
      alert("Vui lòng chọn một Chủ đề (Topic) ở bối cảnh trước khi tải tài liệu!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const userId = localStorage.getItem('userId') || 'guest';
    
    setIsUploading(true);
    setUploadProgress(10);
    setUploadMessage('');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('topic', currentTopic);
    formData.append('user_id', userId); // Chốt chặt file này là của ai

    try {
      const progressInterval = window.setInterval(() => {
        setUploadProgress(prev => (prev < 90 ? prev + 15 : prev));
      }, 300);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      window.clearInterval(progressInterval);
      setUploadProgress(100);

      if (res.ok) {
        setUploadMessage("Tải lên tài liệu thành công");
        fetchDocs(); // Quét lại bảng ngay lập tức
      } else {
        setUploadMessage("Tải lên thất bại. Vui lòng thử lại!");
      }
    } catch (error) {
      setUploadProgress(0);
      setUploadMessage("Lỗi kết nối đường truyền!");
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        if (uploadMessage === "Tải lên tài liệu thành công") setUploadMessage('');
      }, 3000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 🌟 3. HÀM XÓA TÀI LIỆU
  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation(); 
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi hệ thống?')) return;
    
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedIds.includes(id)) {
          onChangeIds(selectedIds.filter(x => x !== id));
        }
        fetchDocs(); 
      } else {
        alert("Xóa thất bại!");
      }
    } catch (error) {
      alert("Lỗi khi xóa tài liệu!");
    }
  };

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

  // Format UI
  const formatSize = (bytes?: number) => {
    if (!bytes) return '--';
    const kb = bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(1)} KB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--/--/----';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '--/--/----' : date.toLocaleDateString('vi-VN');
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      
      {selectedDocs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedDocs.map(doc => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 bg-surface-container border border-border-light text-text-emphasis text-small-base font-small-base px-3 py-1 rounded-full shadow-floating"
            >
              <span className="material-symbols-outlined text-[14px] text-text-secondary">description</span>
              <span className="max-w-[140px] truncate">{doc.name}</span>
              <button
                type="button"
                onClick={() => toggle(doc.id)}
                className="hover:text-negative ml-1 transition-colors flex items-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChangeIds([])}
            className="text-xs text-text-secondary hover:text-negative transition-colors ml-1 font-nav-link-inactive cursor-pointer"
          >
            Xóa hết
          </button>
        </div>
      )}

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

      {/* 🌟 POPOVER BẢNG QUẢN LÝ TÀI LIỆU (CÓ UPLOAD & XÓA) */}
      {open && (
        <div className="absolute bottom-full left-0 mb-3 w-80 bg-surface-container border border-border-gray rounded-xl shadow-dialog z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gray flex items-center justify-between bg-panel-surface">
            <span className="text-sm font-body-bold text-text-emphasis">Chọn tài liệu tham khảo</span>
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-primary hover:bg-primary-fixed text-on-primary px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title={!currentTopic ? "Vui lòng chọn một Chủ đề (Topic) ở bối cảnh trước khi tải tài liệu!" : ""}
              >
                <span className="material-symbols-outlined text-[14px]">upload</span>
                {isUploading ? 'Đang tải...' : 'Tải lên'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-text-secondary hover:text-text-emphasis transition-colors cursor-pointer flex items-center"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
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
                    <p className="text-sm font-body-base text-text-emphasis truncate">{doc.name}</p>
                    {doc.status && (
                      <p className="text-xs text-text-secondary capitalize">{doc.status}</p>
                    )}
                  </div>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-800 mix-blend-overlay">
                    {uploadProgress}%
                  </span>
                  {uploadMessage && (
                    <span className={`text-xs font-semibold ${uploadMessage.includes('Lỗi') || uploadMessage.includes('thất bại') ? 'text-red-500' : 'text-green-600'}`}>
                      {uploadMessage}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>

          {/* Bảng dữ liệu */}
          <div className="max-h-[300px] overflow-y-auto bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white sticky top-0 border-b border-gray-200 z-10 shadow-sm">
                <tr>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-700 uppercase w-10">Chọn</th>
                  <th className="py-3 px-2 text-[11px] font-bold text-gray-700 uppercase">Tên Tài Liệu</th>
                  <th className="py-3 px-2 text-[11px] font-bold text-gray-700 uppercase">Kích Thước</th>
                  <th className="py-3 px-2 text-[11px] font-bold text-gray-700 uppercase">Trạng Thái</th>
                  <th className="py-3 px-2 text-[11px] font-bold text-gray-700 uppercase">Ngày Tải Lên</th>
                  <th className="py-3 px-4 text-[11px] font-bold text-gray-700 uppercase text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                      Chưa có tài liệu nào thuộc chủ đề này.
                    </td>
                  </tr>
                ) : (
                  docs.map(doc => (
                    <tr 
                      key={doc.id} 
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      onClick={() => toggle(doc.id)}
                    >
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(doc.id)}
                          readOnly
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-sm text-gray-800 font-medium max-w-[150px] truncate" title={doc.name}>
                        {doc.name}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-gray-500">
                        {formatSize(doc.size)}
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                          doc.status === 'completed' || doc.status === 'indexed' 
                            ? 'bg-green-600 text-white' 
                            : doc.status === 'failed' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-gray-400 text-white'
                        }`}>
                          {doc.status || 'indexed'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-gray-500">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button 
                          onClick={(e) => handleDelete(e, doc.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm transition-colors"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && docs.length > 0 && selectedIds.length > 0 && (
            <div className="px-4 py-3 border-t border-border-gray flex justify-between items-center bg-panel-surface">
              <span className="text-xs text-text-secondary font-small-base">
                Đã chọn {selectedIds.length}/{docs.length}
              </span>
              <button
                type="button"
                onClick={() => onChangeIds([])}
                className="text-xs text-negative hover:text-error transition-colors font-small-bold cursor-pointer"
              >
                Bỏ đính kèm tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}