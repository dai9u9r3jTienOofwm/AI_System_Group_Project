/**
 * Login Page - Trang đăng nhập của hệ thống
 * 
 * Tác dụng:
 * - Cho phép người dùng nhập email và mật khẩu
 * - Gửi thông tin đó tới backend API để xác thực
 * - Nếu thành công, lưu token và chuyển hướng tới trang dashboard
 * - Nếu thất bại, hiển thị lỗi
 * 
 * 'use client': Trang này chạy ở phía trình duyệt (cần interactive)
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, message, Spin } from 'antd';  // Dùng Ant Design UI library
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);  // Trạng thái: đang gửi request hay không?
  const router = useRouter();  // Hook để chuyển hướng trang

  /**
   * Hàm xử lý khi người dùng submit form
   * Nhận values = { email, password } từ form
   */
  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);  // Hiển thị loading spinner
    try {
      // Gửi email + password tới API backend tại /api/auth/login
      const response = await axios.post('/api/auth/login', values);
      
      // Lưu token vào localStorage để dùng cho các request tiếp theo
      localStorage.setItem('authToken', response.data.token);
      
      // Hiển thị thông báo thành công
      message.success('Đăng nhập thành công');
      
      // Chuyển hướng đến trang dashboard
      router.push('/dashboard');
    } catch (error) {
      // Xử lý lỗi - trích xuất thông báo lỗi từ response
      const errorMessage =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      // Hiển thị thông báo lỗi
      message.error(errorMessage || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);  // Ẩn loading spinner dù thành công hay thất bại
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-gray-600 mt-2">RAG Chatbot AI Management</p>
        </div>

        <Spin spinning={loading}>
          <Form onFinish={onFinish} layout="vertical">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email' },
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Email"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Mật khẩu"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                Đăng Nhập
              </Button>
            </Form.Item>
          </Form>
        </Spin>

        <div className="text-center text-sm text-gray-600">
          <p>Demo: admin@example.com / password123</p>
        </div>
      </Card>
    </div>
  );
}