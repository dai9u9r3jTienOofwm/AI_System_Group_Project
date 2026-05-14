import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const CREDENTIALS: Record<string, { password: string; role: 'admin' | 'client' }> = {
  [process.env.ADMIN_USERNAME ?? 'admin']: {
    password: process.env.ADMIN_PASSWORD ?? 'admin123',
    role: 'admin',
  },
  [process.env.CLIENT_USERNAME ?? 'user']: {
    password: process.env.CLIENT_PASSWORD ?? 'user123',
    role: 'client',
  },
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'your-secret-key-change-this'
);

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const user = CREDENTIALS[username as string];
    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu không đúng.' },
        { status: 401 }
      );
    }

    const token = await new SignJWT({ userId: username, email: `${username}@system`, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(JWT_SECRET);

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 8,
      path: '/',
    };

    const response = NextResponse.json({ role: user.role });
    response.cookies.set('auth_role', user.role, cookieOpts);
    response.cookies.set('authToken', token, cookieOpts);

    return response;
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ.' }, { status: 500 });
  }
}
