'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Paperclip, X, FileText, RefreshCw, ChevronDown, UploadCloud } from 'lucide-react';

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

  useEffect(() => {
    setDocs([]);
    if (open) {
      fetchDocs();
    }
  }, [open, fetchDocs]);

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
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {selectedDocs.map(doc => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-700 text-[11px] px-2 py-0.5 rounded-md"
            >
              <FileText size={11} className="text-blue-600" />
              <span className="max-w-[140px] truncate">{doc.name}</span>
              <button
                type="button"
                onClick={() => toggle(doc.id)}
                className="text-gray-400 hover:text-red-500 ml-0.5 transition-colors"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChangeIds([])}
            className="text-[11px] text-gray-400 hover:text-red-500 transition-colors ml-1"
          >
            Xóa hết
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
          selectedIds.length > 0
            ? 'bg-blue-50 border-blue-200 text-blue-600'
            : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        <Paperclip size={12} />
        Quản lý & Đính kèm tài liệu
        {selectedIds.length > 0 && (
          <span className="bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
            {selectedIds.length}
          </span>
        )}
        <ChevronDown size={12} className={`opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 🌟 POPOVER BẢNG QUẢN LÝ TÀI LIỆU (CÓ UPLOAD & XÓA) */}
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-[550px] max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-150 flex flex-col">
          
          {/* Header & Công cụ tải file */}
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-4 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-800">Tải lên tài liệu: [{currentTopic}]</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleUpload} 
                className="hidden" 
                accept=".pdf,.md,.txt,.docx,.csv" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <UploadCloud size={16} /> Chọn tài liệu tải lên
              </button>
              <button 
                onClick={fetchDocs}
                disabled={loading || isUploading}
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors ml-auto disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Làm tươi
              </button>
            </div>

            {/* Thanh tiến độ */}
            {(isUploading || uploadProgress > 0) && (
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
                  <div 
                    className="bg-blue-500 h-4 rounded-full transition-all duration-300 flex items-center justify-center" 
                    style={{ width: `${uploadProgress}%` }}
                  >
                  </div>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-800 mix-blend-overlay">
                    {uploadProgress}%
                  </span>
                </div>
                {uploadMessage && (
                  <span className={`text-xs font-semibold ${uploadMessage.includes('Lỗi') || uploadMessage.includes('thất bại') ? 'text-red-500' : 'text-green-600'}`}>
                    {uploadMessage}
                  </span>
                )}
              </div>
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
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-500 font-medium">
                Đang đính kèm {selectedIds.length}/{docs.length} file vào Chat
              </span>
              <button
                type="button"
                onClick={() => onChangeIds([])}
                className="text-red-500 hover:text-red-700 font-bold transition-colors"
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