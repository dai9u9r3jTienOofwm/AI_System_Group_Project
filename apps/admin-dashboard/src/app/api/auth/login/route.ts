/**
 * API Route: POST /api/auth/login (DÀNH CHO ADMIN DASHBOARD)
 * Tác dụng: Nhận email + password, nhờ Python Backend kiểm tra DB
 * Bắt buộc tài khoản phải có is_admin = true mới cho qua!
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Gọi sang Python Backend để check mật khẩu
    const backendUrl = process.env.INTERNAL_API_URL || 'http://host.docker.internal:8000';
    const backendRes = await fetch(`${backendUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json({ detail: data.detail || 'Đăng nhập thất bại' }, { status: backendRes.status });
    }

    // 2. GIẢI QUYẾT MÂU THUẪN 3: Block ngay lập tức nếu không phải Admin
    if (data.is_admin !== true) {
      return NextResponse.json(
        { detail: 'Truy cập bị từ chối: Tài khoản của bạn không có quyền Quản trị viên!' }, 
        { status: 403 }
      );
    }

    // 3. GIẢI QUYẾT MÂU THUẪN 2: Thống nhất Cookie cho toàn hệ thống
    const response = NextResponse.json({ status: 'success', message: 'Đăng nhập Admin thành công' });
    
    // Set cookie chuẩn như proxy.ts đang tìm kiếm
    response.cookies.set('userId', data.id, { path: '/', maxAge: 86400, sameSite: 'lax' });
    response.cookies.set('auth_role', 'admin', { path: '/', maxAge: 86400, sameSite: 'lax' });

    return response;

  } catch (error) {
    console.error('Admin Login Error:', error);
    return NextResponse.json({ detail: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}