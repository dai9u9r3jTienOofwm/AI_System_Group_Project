'use client';

import { useEffect, useState } from 'react';
import { Card, Table, Upload, Button, Space, message, Progress, Tag, Popconfirm, Select } from 'antd';
import { CloudUploadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import { AVAILABLE_TOPICS } from '@/lib/constants';

interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: 'uploaded' | 'queued' | 'processing' | 'completed' | 'indexed' | 'failed';
  progress?: number;
  error_message?: string | null;
  chunk_count?: number | null;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>(undefined);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getIngestStatus();
      setDocuments(res?.documents || []);
    } catch {
      message.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDocuments(); }, []);

const handleUpload = async (file: File) => {
  setUploading(true);
  setUploadProgress(0);

  try {
    const metadata: Record<string, string> = {
      timestamp: new Date().toISOString(),
    };

    // Nếu người dùng chọn topic từ dropdown thì gửi lên backend
    if (selectedTopic) {
      metadata.topic = selectedTopic;
    }

    await apiClient.uploadDocument(file, metadata);

    setUploadProgress(100);

    message.success(
      selectedTopic
        ? `Tải lên tài liệu thành công với topic: ${selectedTopic}`
        : 'Tải lên tài liệu thành công'
    );

    setTimeout(() => {
      loadDocuments();
      setUploadProgress(0);
    }, 1000);
  } catch (error) {
    const msg =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;

    message.error(msg || 'Tải lên tài liệu thất bại');
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
    { title: 'Tên Tài Liệu', dataIndex: 'name', key: 'name' },
    {
      title: 'Kích Thước', dataIndex: 'size', key: 'size',
      render: (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`,
    },
    {
      title: 'Trạng Thái', dataIndex: 'status', key: 'status',
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
            <span className="text-xs text-red-400 ml-1" title={record.error_message}>⚠</span>
          )}
        </>
      ),
    },
    {
      title: 'Tiến Độ', dataIndex: 'progress', key: 'progress',
      render: (progress: number) => progress !== undefined ? <Progress percent={progress} /> : '-',
    },
    {
      title: 'Ngày Tải Lên', dataIndex: 'uploadedAt', key: 'uploadedAt',
      render: (date: string) => new Date(date).toLocaleString('vi-VN'),
    },
    {
      title: 'Hành Động', key: 'action',
      render: (_: unknown, record: Document) => (
        <Popconfirm
          title="Xác nhận xóa"
          description="Bạn chắc chắn muốn xóa tài liệu này?"
          onConfirm={() => handleDelete(record.id)}
          okText="Có" cancelText="Không"
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">Xóa</Button>
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
            <h3 className="mb-3 text-base font-semibold text-slate-100">Chọn Chủ Đề (Optional)</h3>
            <Select
              placeholder="Chọn chủ đề cho tài liệu (tùy chọn)"
              style={{ width: '100%', marginBottom: '12px' }}
              allowClear
              value={selectedTopic}
              onChange={setSelectedTopic}
              options={AVAILABLE_TOPICS.map((topic) => ({
                label: topic,
                value: topic,
              }))}
            />
          </div>
          <div>
            <h3 className="mb-3 text-base font-semibold text-slate-100">Tải Lên Tài Liệu Mới</h3>
            <Upload maxCount={1} beforeUpload={(file) => { handleUpload(file); return false; }} disabled={uploading}>
              <Button type="primary" icon={<CloudUploadOutlined />} loading={uploading}>
                Chọn Tài Liệu để Tải Lên
              </Button>
            </Upload>
            {uploadProgress > 0 && <Progress percent={uploadProgress} className="mt-3" />}
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadDocuments} loading={loading}>Làm mới</Button>
        </Space>
      </Card>

      <Card className="border border-white/15 bg-slate-950/70 text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <Table
          columns={columns}
          dataSource={documents.map((d) => ({ ...d, key: d.id }))}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
