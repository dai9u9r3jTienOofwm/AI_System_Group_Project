import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || 'http://backend:8000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ document_id: string }> }
) {
  try {
    const { document_id } = await context.params;

    const chunkIndex =
      request.nextUrl.searchParams.get('chunk_index') || '0';

    const cookieHeader = request.headers.get('cookie') ?? '';

    const backendUrl =
      `${BACKEND_URL}/v1/documents/${encodeURIComponent(document_id)}` +
      `/chunk-preview?chunk_index=${encodeURIComponent(chunkIndex)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    const contentType =
      response.headers.get('content-type') || 'application/json';

    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('❌ Frontend proxy chunk-preview error:', error);

    return NextResponse.json(
      { error: 'Không thể tải nội dung chunk từ backend.' },
      { status: 500 }
    );
  }
}