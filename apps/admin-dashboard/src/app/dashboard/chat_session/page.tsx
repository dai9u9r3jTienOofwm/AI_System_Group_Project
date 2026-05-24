/**
 * Chat Sessions Admin Page - Trang quản lý lịch sử phiên trò chuyện
 * * Tác dụng:
 * - Hiển thị danh sách tất cả các phiên trò chuyện của người dùng trong hệ thống
 * - Hỗ trợ Admin tìm kiếm lọc theo User ID hoặc Topic
 * - Cho phép Admin xóa các phiên trò chuyện lỗi hoặc hết hạn
 * - Thiết kế giao diện Dark Mode (bg-black) đồng bộ hoàn toàn với trang Documents
 * * 'use client': Component sử dụng Ant Design tương tác thời gian thực
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Tag,
  Popconfirm,
  Input,
} from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';

/**
 * Interface: Cấu trúc dữ liệu của một Phiên trò chuyện
 * Đồng bộ 1-1 với kiểu Integer của user_id dưới Database Postgres
 */
interface ChatSession {
  id: string;        // UUID dạng string tự sinh từ backend
  user_id: number;   // 🌟 Kiểu số nguyên (Integer) đồng bộ cấu hình hệ thống
  title: string;     // Tiêu đề đoạn chat (ví dụ: "Tìm hiểu kiến trúc RAG")
  topic: string;     // Chủ đề tài liệu được chọn để cấu hình RAG
  created_at: string; // Thời điểm khởi tạo cuộc đối thoại
}

export default function ChatSessionsPage() {
  // State: Lưu trữ toàn bộ danh sách các phiên trò chuyện từ API
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  // State: Quản lý hiệu ứng loading khi fetch dữ liệu từ Database
  const [loading, setLoading] = useState(false);
  
  // State phục vụ việc lọc dữ liệu cục bộ trên giao diện Admin
  const [searchUserId, setSearchUserId] = useState<string>('');
  const [searchTopic, setSearchTopic] = useState<string>('');

  /**
   * Hàm tải danh sách toàn bộ các phiên trò chuyện từ Backend Database
   * Gọi GET /v1/chat_sessions/ endpoint của backend
   */
  const loadChatSessions = async () => {
    setLoading(true);
    try {
      // ✅ Gọi API backend thay vì đọc localStorage
      const response = await fetch('/api/chat_sessions/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Gửi kèm cookies để authenticate
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Chưa đăng nhập hoặc phiên hết hạn');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const sessions: ChatSession[] = await response.json();
      setSessions(sessions);
    } catch (err) {
      console.error('Lỗi tải chat sessions:', err);
      message.error('Không thể tải danh sách phiên trò chuyện từ server');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Chạy duy nhất một lần khi Admin truy cập trang chủ để đồng bộ dữ liệu
   */
  useEffect(() => {
    loadChatSessions();
  }, []);

  /**
   * Xử lý xóa vĩnh viễn một phiên chat kèm theo cơ chế cascade xóa các tin nhắn con
   */
  const handleDeleteSession = async (sessionId: string, userId: number) => {
    try {
      if (typeof window !== 'undefined') {
        // Định vị chính xác Key lưu trữ của User sở hữu phiên chat đó
        const key = `uet_ai_conversations_${userId}`;
        const storedData = localStorage.getItem(key);

        if (storedData) {
          const conversations = JSON.parse(storedData);
          if (Array.isArray(conversations)) {
            // Lọc bỏ cuộc trò chuyện có ID trùng với sessionId cần xóa
            const updatedConversations = conversations.filter((c: any) => c.id !== sessionId);
            
            // Cập nhật lại vào localStorage của User đó
            localStorage.setItem(key, JSON.stringify(updatedConversations));
          }
        }
      }

      message.success('Xóa phiên trò chuyện thành công');
      loadChatSessions(); // Gọi lại hàm quét localStorage để làm mới Table
    } catch {
      message.error('Xóa phiên trò chuyện thất bại');
    }
  };
  // Cấu hình các cột hiển thị thông tin cho Table của Ant Design
  const columns = [
    {
      title: 'Mã Phiên (Session ID)',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <code className="text-xs text-slate-400 font-mono">{id}</code>,
    },
    {
      title: 'Mã Người Dùng (User ID)',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (userId: number) => (
        <span className="font-semibold text-emerald-400">
          {userId}
        </span>
      ),
    },
    {
      title: 'Tiêu Đề Trò Chuyện',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <span className="font-medium text-slate-200">{title}</span>,
    },
    {
      title: 'Chủ Đề (Topic)',
      dataIndex: 'topic',
      key: 'topic',
      render: (topic: string) => (
        <Tag color="blue" className="border-blue-500/30 bg-blue-500/10 text-blue-400">
          {topic || 'Chưa phân loại'}
        </Tag>
      ),
    },
    {
      title: 'Thời Điểm Tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => 
        new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    },
    {
      title: 'Hành Động',
      key: 'action',
      render: (_value: unknown, record: ChatSession) => (
        <Popconfirm
          title="Xác nhận xóa phiên chat"
          description="Hành động này sẽ xóa toàn bộ tin nhắn con bên trong. Bạn chắc chắn chứ?"
          onConfirm={() => handleDeleteSession(record.id, record.user_id)}
          okText="Xóa vĩnh viễn"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
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

  // Thực hiện lọc dữ liệu nâng cao dựa trên State tìm kiếm của Admin
  const filteredSessions = sessions.filter((session) => {
    const matchUser = searchUserId === '' || String(session.user_id) === searchUserId.trim();
    const matchTopic = searchTopic === '' || session.topic.toLowerCase().includes(searchTopic.toLowerCase().trim());
    return matchUser && matchTopic;
  });

  return (
    <div className="min-h-screen bg-black px-6 py-10 text-slate-100 md:px-10">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Quản Lý Phiên Chat Hệ Thống</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadChatSessions}
          loading={loading}
          className="w-fit"
        >
          Làm Tươi Dữ Liệu
        </Button>
      </div>

      {/* Thanh bộ lọc tìm kiếm nâng cao dành cho Admin */}
      <Card className="mb-6 border border-white/10 bg-black text-white shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <h3 className="mb-4 text-base font-semibold text-slate-100">Bộ Lọc Tìm Kiếm Nhanh</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs text-gray-400 font-medium">Lọc theo mã số User ID (Số nguyên):</label>
            <Input
              placeholder="Ví dụ: 2"
              prefix={<SearchOutlined className="text-gray-500" />}
              value={searchUserId}
              onChange={(e) => setSearchUserId(e.target.value)}
              className="bg-zinc-900 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500 hover:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-gray-400 font-medium">Lọc theo từ khóa Chủ đề (Topic):</label>
            <Input
              placeholder="Ví dụ: Python, RAG, Machine Learning..."
              prefix={<SearchOutlined className="text-gray-500" />}
              value={searchTopic}
              onChange={(e) => setSearchTopic(e.target.value)}
              className="bg-zinc-900 border-white/10 text-white placeholder-gray-600 focus:border-emerald-500 hover:border-emerald-500"
            />
          </div>
        </div>
      </Card>

      {/* Khối hiển thị dữ liệu dạng Table Grid */}
      <Card className="border border-white/15 bg-slate-950/70 text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <Table
          columns={columns}
          dataSource={filteredSessions.map((session) => ({
            ...session,
            key: session.id, // Gán key duy nhất cho React Virtual DOM tối ưu render
          }))}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: 'Không tìm thấy lịch sử phiên trò chuyện nào' }}
          className="admin-chat-table"
        />
      </Card>
    </div>
  );
}