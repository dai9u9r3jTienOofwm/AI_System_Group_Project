import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Xóa các cookies session
  response.cookies.delete('adminSession');
  response.cookies.delete('userId');
  response.cookies.delete('auth_role');
  
  return response;
}