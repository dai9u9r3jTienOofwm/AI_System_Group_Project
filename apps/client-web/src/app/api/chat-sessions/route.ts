import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const userId = cookieStore.get('userId')?.value;
    const cookieHeader = userId ? `userId=${userId}` : '';

    const response = await fetch('http://backend:8000/v1/chat-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
