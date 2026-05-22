/**
 * Documents Page - Trang quản lý tài liệu
 * 
 * Tác dụng:
 * - Hiển thị danh sách các tài liệu đã upload
 * - Cho phép upload tài liệu mới
 * - Xóa tài liệu
 * - Xem trạng thái xử lý (processing/completed/failed)
 * - Hiển thị thanh tiến độ upload
 * 
 * 'use client': Component này cần interactivity (upload, delete, etc.)
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Upload,
  Button,
  Space,
  message,
  Progress,
  Tag,
  Popconfirm,
} from 'antd';
import { CloudUploadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';

/**
 * Interface: Cấu trúc dữ liệu một tài liệu
 * Tương ứng với cấu trúc trả về từ backend
 */
interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: 'uploaded' | 'queued' | 'processing' | 'completed' | 'indexed' | 'failed';
  topic?: string | null;
  error_message?: string | null;
  chunk_count?: number | null;
}

export default function DocumentsPage() {
  // State: danh sách các tài liệu
  const [documents, setDocuments] = useState<Document[]>([]);
  // State: đang tải danh sách từ API?
  const [loading, setLoading] = useState(false);
  // State: đang upload tài liệu?
  const [uploading, setUploading] = useState(false);
  // State: tiến độ upload (0-100%)
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Hàm tải danh sách tài liệu từ backend
   * Sử dụng apiClient.getIngestStatus() định nghĩa ở src/lib/api-client.ts
   */
  const loadDocuments = async () => {
    setLoading(true);  // Bắt đầu loading
    try {
      // Gọi API lấy trạng thái ingestion (bao gồm danh sách tài liệu)
      const response = await apiClient.getIngestStatus();
      // Adjust based on your API response
      setDocuments(response?.documents || []);  // Cập nhật state
    } catch {
      message.error('Failed to load documents');  // Hiển thị lỗi
    } finally {
      setLoading(false);  // Tắt loading
    }
  };

  /**
   * useEffect: Chạy khi component mount (lần đầu tiên load trang)
   * Tự động tải danh sách tài liệu
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDocuments();  // Load danh sách
  }, []);  // [] = chỉ chạy 1 lần khi component mount

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      await apiClient.uploadDocument(file, {
        timestamp: new Date().toISOString(),
      });

      setUploadProgress(100);
      message.success('Tải lên tài liệu thành công');
      setTimeout(() => {
        loadDocuments();
        setUploadProgress(0);
      }, 1000);
    } catch (error) {
      const errorMessage =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      message.error(errorMessage || 'Tải lên tài liệu thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await apiClient.deleteDocument(docId);
      message.success('Xóa tài liệu thành công');
      loadDocuments();
    } catch {
      message.error('Xóa tài liệu thất bại');
    }
  };

  const columns = [
    {
      title: 'Tên Tài Liệu',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Kích Thước',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Document) => (
        <>
          <Tag
            color={
              status === 'completed' || status === 'indexed'
                ? 'green'
                : status === 'processing'
                ? 'blue'
                : status === 'queued'
                ? 'orange'
                : status === 'uploaded'
                ? 'default'
                : 'red'
            }
          >
            {status}
          </Tag>
          {status === 'failed' && record.error_message && (
            <span className="text-xs text-red-400 ml-1" title={record.error_message}>
              ⚠
            </span>
          )}
        </>
      ),
    },
    {
      title: 'Topic',
      dataIndex: 'topic',
      key: 'topic',
      render: (topic: string) => topic || '-',
    },
    {
      title: 'Ngày Tải Lên',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date: string) => new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    },
    {
      title: 'Hành Động',
      key: 'action',
      render: (_value: unknown, record: Document) => (
        <Popconfirm
          title="Xác nhận xóa"
          description="Bạn chắc chắn muốn xóa tài liệu này?"
          onConfirm={() => handleDelete(record.id)}
          okText="Có"
          cancelText="Không"
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
          >
            Xóa
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-slate-100 md:px-10">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight text-white">Quản Lý Tài Liệu</h1>

      <Card className="mb-6 border border-white/10 bg-black text-white shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>
            <h3 className="mb-3 text-base font-semibold text-slate-100">Tải Lên Tài Liệu Mới</h3>
            <Upload
              maxCount={1}
              beforeUpload={(file) => {
                handleUpload(file);
                return false;
              }}
              disabled={uploading}
            >
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                loading={uploading}
              >
                Chọn Tài Liệu để Tải Lên
              </Button>
            </Upload>
            {uploadProgress > 0 && (
              <Progress percent={uploadProgress} className="mt-3" />
            )}
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadDocuments}
            loading={loading}
          >
            Làm Tươi
          </Button>
        </Space>
      </Card>

      <Card className="border border-white/15 bg-slate-950/70 text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <Table
          columns={columns}
          dataSource={documents.map((doc) => ({
            ...doc,
            key: doc.id,
          }))}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}