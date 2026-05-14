/**
 * API Route: POST /api/auth/login
 * Tác dụng: Nhận email + password, kiểm tra, tạo token JWT
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // TODO: Thay bằng xác thực thực tế (kiểm tra DB)
    // Đây là demo đơn giản
    if (email === 'admin@example.com' && password === 'password123') {
      const token = generateToken({
        userId: '1',
        email: 'admin@example.com',
        role: 'admin',
      });

      const response = NextResponse.json({ success: true, token });
      
      // Set token trong cookie
      response.cookies.set('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}