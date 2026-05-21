import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // 1. Lấy pathname để biết người dùng đang bấm vào trang nào
  const { pathname } = request.nextUrl; 

  // 2. ĐÃ SỬA: Không tìm authToken nữa, bốc trực tiếp userId và auth_role từ Cookie ra
  const userId = request.cookies.get('userId')?.value; 
  const userRole = request.cookies.get('auth_role')?.value || 'client'; 

  // Định nghĩa các vùng trang trạng thái
  const isLoginPage = pathname === '/login';
  const isRegisterPage = pathname === '/register';
  const isAdminPage = pathname.startsWith('/admin'); 

  // ==========================================
  // TRƯỜNG HỢP 1: CHƯA ĐĂNG NHẬP (!userId)
  // ==========================================
  if (!userId) {
    // Nếu chưa đăng nhập mà cố vào các trang bảo mật -> Đá thẳng về trang /login
    if (!isLoginPage && !isRegisterPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Nếu chưa đăng nhập mà đang đứng sẵn ở login/register -> Cho phép hiển thị giao diện
    return NextResponse.next();
  }

  // ==========================================
  // TRƯỜNG HỢP 2: ĐÃ ĐĂNG NHẬP (Có userId hợp lệ)
  // ==========================================
  
  // 1. Đã đăng nhập rồi mà cố tình quay lại trang /login hoặc /register -> Đẩy về trang chủ
  if (isLoginPage || isRegisterPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. Chặn mọi người dùng vào vùng /admin của client-web (admin dùng localhost:3001)
  if (isAdminPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Tất cả các trường hợp chuyển trang hợp lệ khác cho phép đi tiếp bình thường
  return NextResponse.next();
}

// Cấu hình các đường dẫn chạy qua bộ lọc này (Bỏ qua API, Static Files, Images, Favicon)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};