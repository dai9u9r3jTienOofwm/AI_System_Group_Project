import { NextRequest, NextResponse } from 'next/server';
// 🌟 1. BẮT BUỘC IMPORT COOKIES ĐỂ VƯỢT ẢI 401
import { cookies } from 'next/headers'; 

export async function POST(request: NextRequest) {
  try {
    // Đọc FormData gửi lên từ giao diện Frontend
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file tải lên' }, { status: 400 });
    }

    // 🌟 2. LẤY COOKIE ĐĂNG NHẬP CỦA NGƯỜI DÙNG
    const cookieStore = await cookies();
    const cookieString = cookieStore.toString();

    // Tạo một FormData mới để chuyển tiếp (forward) sang Backend Python
    const backendFormData = new FormData();
    backendFormData.append('file', file);

    // 🌟 3. SỬA LẠI ĐÚNG ĐƯỜNG DẪN CỦA PYTHON: /v1/documents/upload
    const response = await fetch('http://backend:8000/v1/chat/upload', {
      method: 'POST',
      headers: {
        // 🌟 4. KẸP COOKIE VÀO HEADER ĐỂ KHÔNG BỊ PYTHON ĐÁ RA (LỖI 401)
        'Cookie': cookieString, 
        // Lưu ý quan trọng: TUYỆT ĐỐI KHÔNG set 'Content-Type' ở đây, 
        // fetch sẽ tự động sinh ra Boundary chuẩn xác.
      },
      body: backendFormData, 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Lỗi từ Backend Python:', errorText);
      return NextResponse.json(
        { error: `Backend Python xử lý file thất bại (Mã lỗi: ${response.status})` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Trả kết quả thành công về cho giao diện Frontend
    return NextResponse.json({ 
      success: true, 
      message: 'Tải tài liệu lên hệ thống thành công!',
      data: data 
    });

  } catch (error) {
    console.error('❌ Lỗi tại Next.js API Route Upload:', error);
    return NextResponse.json({ error: 'Lỗi server trung gian Next.js BFF' }, { status: 500 });
  }
}