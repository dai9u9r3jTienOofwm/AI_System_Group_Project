'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Popconfirm,
  Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
  status: 'active' | 'inactive';
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getUsers();
      setUsers(response.data || []);
    } catch {
      message.error('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
  }, []);

  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        await apiClient.updateUser(editingUser.id, values);
        message.success('Cập nhật người dùng thành công');
      } else {
        await apiClient.createUser(values);
        message.success('Thêm người dùng thành công');
      }
      setIsModalVisible(false);
      loadUsers();
    } catch {
      message.error('Hành động thất bại');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await apiClient.deleteUser(userId);
      message.success('Xóa người dùng thành công');
      loadUsers();
    } catch {
      message.error('Xóa người dùng thất bại');
    }
  };

  const columns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Vai Trò',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag
          color={
            role === 'admin'
              ? 'red'
              : role === 'editor'
              ? 'blue'
              : 'default'
          }
        >
          {role}
        </Tag>
      ),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Ngày Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('vi-VN'),
    },
    {
      title: 'Hành Động',
      key: 'action',
      render: (_value: unknown, record: User) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
            size="small"
          >
            Sửa
          </Button>
          <Popconfirm
            title="Xác nhận xóa"
            description="Bạn chắc chắn muốn xóa người dùng này?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Có"
            cancelText="Không"
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small">
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.9),_rgba(2,6,23,1)_55%,_rgba(0,0,0,1)_100%)] px-6 py-10 text-slate-100 md:px-10">
      <h1 className="mb-6 text-3xl font-semibold text-white">Quản Lý Người Dùng</h1>

      <Card className="border border-white/10 bg-slate-950/70 text-slate-100 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddUser}
          className="mb-4"
        >
          Thêm Người Dùng
        </Button>

        <Table
          columns={columns}
          dataSource={users.map((user) => ({
            ...user,
            key: user.id,
          }))}
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      <Modal
        title={editingUser ? 'Chỉnh Sửa Người Dùng' : 'Thêm Người Dùng'}
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        className="dark-modal"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai Trò"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select
              options={[
                { label: 'Admin', value: 'admin' },
                { label: 'Editor', value: 'editor' },
                { label: 'Viewer', value: 'viewer' },
              ]}
            />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="Mật Khẩu"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}