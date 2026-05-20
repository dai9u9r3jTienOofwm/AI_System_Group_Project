/**
 * API Route: POST /api/auth/login (DÀNH CHO CLIENT WEB)
 * Tác dụng: Nhận email + password, gọi sang Python Backend kiểm tra PostgreSQL.
 * Lưu session đơn giản bằng uuid4, không dùng JWT.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Lưu ý: Backend Python đang nhận vào là 'email'. 
    // Nếu form của bạn gửi lên 'username', nhớ map lại giá trị cho đúng nhé.
    const email = body.email || body.username; 
    const password = body.password;

    // 1. Gọi sang Python Backend để xác thực
    const backendUrl = process.env.INTERNAL_API_URL || 'http://backend:8000';
    const backendRes = await fetch(`${backendUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await backendRes.json();

    // 2. Xử lý khi sai thông tin (Backend trả về lỗi)
    if (!backendRes.ok || data.status !== 'success') {
      return NextResponse.json(
        { error: data.detail || 'Tài khoản hoặc mật khẩu không chính xác.' },
        { status: 401 }
      );
    }

    // 3. Phân quyền: Ai cũng vào được Client Web
    const userRole = data.is_admin ? 'admin' : 'client';

    // 4. Lưu session dạng JSON thuần chứa uuid4 từ Backend
    const sessionData = JSON.stringify({ id: data.id, role: userRole });
    
    const response = NextResponse.json({ 
      success: true, 
      userId: data.id,
      role: userRole 
    });
    
    // 5. Thiết lập Cookie (Giống cấu hình cũ của bạn nhưng lưu chuỗi session thay vì token)
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24, // 1 ngày
      path: '/',
    };

    // Đặt cookie riêng cho Client Web
    response.cookies.set('clientSession', sessionData, cookieOpts);
    
    // Nếu các component khác ở Frontend của bạn đang dựa vào cookie 'auth_role' để render giao diện,
    // thì cứ set thêm một cái cookie phụ này cho chúng hoạt động bình thường
    response.cookies.set('auth_role', userRole, cookieOpts);

    return response;

  } catch (error) {
    console.error("Lỗi kết nối Backend:", error);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ.' }, { status: 500 });
  }
}