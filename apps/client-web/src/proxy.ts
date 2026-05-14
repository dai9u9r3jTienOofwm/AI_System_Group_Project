import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const role = request.cookies.get('auth_role')?.value;
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === '/login';
  const isAdminPage = pathname.startsWith('/admin');

  if (!role && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (role && isLoginPage) {
    return NextResponse.redirect(new URL(role === 'admin' ? '/admin' : '/', request.url));
  }

  if (role === 'client' && isAdminPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (role === 'admin' && pathname === '/') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
