import { NextResponse } from 'next/server';

export async function POST() {
  // 1. Trả về thông báo thành công
  const response = NextResponse.json({ 
    success: true, 
    message: 'Đăng xuất thành công' 
  });
  
  // 2. Cấu hình "tử hình" Cookie: Ép maxAge về 0 và thời gian hết hạn về quá khứ
  const expiredOptions = { 
    httpOnly: true, 
    maxAge: 0, 
    path: '/',
    expires: new Date(0) // 💥 Chốt chặn an toàn: Bắt buộc trình duyệt xóa ngay lập tức
  };
  
  // 3. Xóa toàn bộ các Cookie định danh
  response.cookies.set('userId', '', expiredOptions);    // 🎯 Quan trọng nhất: Xóa ID người dùng
  response.cookies.set('auth_role', '', expiredOptions); // Xóa quyền hạn
  
  // (Dự phòng) Xóa các token khác nếu Backend Python của nhóm có cài cắm thêm
  response.cookies.set('authToken', '', expiredOptions);
  response.cookies.set('session', '', expiredOptions); 

  return response;
}