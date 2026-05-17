'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onFinish = async (values: { email: string; password: string }) => {
  setLoading(true);
  try {
    // 1. GIẢI QUYẾT MÂU THUẪN 1: Gọi vào Route nội bộ thay vì gọi thẳng Python
    // (Route này sẽ tự động lo việc check quyền và gắn Cookie an toàn)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    const data = await res.json();

    if (!res.ok) {
      // Nếu là user thường, sẽ bị quăng lỗi 403 chặn đứng ở đây luôn
      throw new Error(data.detail || 'Lỗi đăng nhập');
    }
    
    // 2. Backend đã tự set cookie, Frontend chỉ việc lưu ID vào localStorage cho tiện dùng (nếu cần)
    // Không cần dùng document.cookie thủ công ở đây nữa!
    localStorage.setItem('userRole', 'admin');
    
    message.success('Đăng nhập Quản trị viên thành công!');
    
    // 3. Chuyển hướng vào trang Dashboard
    router.push('/dashboard'); // hoặc /admin tùy router của nhóm
    router.refresh();
    
  } catch (error: any) {
    message.error(error.message || 'Đăng nhập thất bại, vui lòng kiểm tra lại!');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-2xl border-0">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-gray-500 mt-2">RAG AI System Management</p>
        </div>

        {/* Spin bọc bên ngoài sẽ làm mờ toàn bộ form khi đang gọi API */}
        <Spin spinning={loading} tip="Đang xác thực...">
          <Form onFinish={onFinish} layout="vertical" size="large">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email!' },
                { type: 'email', message: 'Định dạng email không hợp lệ!' },
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="admin@example.com"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="••••••••"
              />
            </Form.Item>

            <Form.Item className="mt-6 mb-2">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="bg-blue-600 hover:bg-blue-500"
              >
                Đăng Nhập
              </Button>
            </Form.Item>
          </Form>
        </Spin>

        <div className="text-center text-sm text-gray-400 mt-6 pt-4 border-t border-gray-100">
          <p>Tài khoản thử nghiệm: admin@example.com / password123</p>
        </div>
      </Card>
    </div>
  );
}