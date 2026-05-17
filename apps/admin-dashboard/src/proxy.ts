/**
 * Proxy Middleware - Kiểm tra session cookies trước khi cho phép truy cập
 * - Nếu chưa đăng nhập: chuyển hướng đến /login
 * - Nếu session hợp lệ: cho phép truy cập
 */
import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value;
  const userRole = request.cookies.get('auth_role')?.value;
  const pathname = request.nextUrl.pathname;

  // Homepage - redirect based on login status
  if (pathname === '/') {
    if (userId && userRole === 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Login page - if already logged in, go to dashboard
  if (pathname === '/login') {
    if (userId && userRole === 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected routes - require valid admin session
  if (pathname.startsWith('/dashboard')) {
    if (!userId || userRole !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/'],
};
