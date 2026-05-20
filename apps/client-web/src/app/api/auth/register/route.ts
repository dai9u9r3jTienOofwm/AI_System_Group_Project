/**
 * API Route: POST /api/auth/register
 * Tác dụng: Nhận email + password từ Client, gọi sang Python Backend để lưu vào PostgreSQL.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // 1. Gọi sang Python Backend (FastAPI) để tạo tài khoản
    const backendUrl = process.env.INTERNAL_API_URL || 'http://backend:8000';
    const backendRes = await fetch(`${backendUrl}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await backendRes.json();

    // 2. Xử lý khi Backend báo lỗi (Ví dụ: Email đã tồn tại)
    if (!backendRes.ok || data.status !== 'success') {
      return NextResponse.json(
        { error: data.detail || 'Đăng ký thất bại. Email có thể đã được sử dụng.' },
        { status: backendRes.status || 400 }
      );
    }

    // 3. Đăng ký thành công -> Trả về JSON để Frontend biết đường chuyển hướng
    return NextResponse.json({ 
      success: true, 
      message: 'Tạo tài khoản thành công!' 
    });

  } catch (error) {
    console.error("Lỗi kết nối Backend lúc đăng ký:", error);
    return NextResponse.json(
      { error: 'Lỗi máy chủ nội bộ. Không thể kết nối đến hệ thống xác thực.' }, 
      { status: 500 }
    );
  }
}