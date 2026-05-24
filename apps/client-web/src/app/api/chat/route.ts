import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 🌟 1. Lấy chính xác giá trị của cookie 'userId' mà trình duyệt gửi lên Next.js
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;

    // 🌟 2. Đóng gói lại thành chuỗi Cookie đúng chuẩn format HTTP
    const cookieHeader = userId ? `userId=${userId}` : '';

    const response = await fetch('http://backend:8000/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 🌟 3. Truyền chuỗi Cookie này sang cho Python
        // Lúc này FastAPI dùng `Cookie(None)` sẽ tự động bóc được ID ra ngon ơ!
        'Cookie': cookieHeader, 
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Lỗi xác thực từ Server AI' }, 
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Lỗi tại API Chat Proxy:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}