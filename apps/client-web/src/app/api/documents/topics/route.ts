import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // 🌟 Thêm module đọc cookie hệ thống

export async function GET() {
  try {
    // Lấy toàn bộ chuỗi cookie từ trình duyệt gửi lên Next.js BFF
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();

    // Gọi xuống Backend Python qua mạng Docker
    const response = await fetch('http://backend:8000/v1/documents/topics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // 🌟 QUAN TRỌNG: Kẹp chuỗi cookie này vào để FastAPI xác thực được userId!
        'Cookie': cookieString, 
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ topics: [] }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ topics: data.topics || [] });

  } catch (error) {
    console.error('Lỗi tại Next.js BFF Route:', error);
    return NextResponse.json({ topics: [] }, { status: 500 });
  }
}