import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  const expired = { httpOnly: true, maxAge: 0, path: '/' };
  response.cookies.set('auth_role', '', expired);
  response.cookies.set('authToken', '', expired);
  return response;
}
