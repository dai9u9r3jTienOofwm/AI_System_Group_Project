import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.INTERNAL_API_URL || 'http://backend:8000';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/v1/admin/chat_sessions`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    const res = await fetch(`${BACKEND_URL}/v1/admin/chat_sessions/${sessionId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
