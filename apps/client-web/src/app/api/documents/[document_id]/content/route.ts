import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL || 'http://backend:8000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ document_id: string }> }
) {
  try {
    const { document_id } = await context.params;

    // Lấy cookie thật từ request browser gửi vào Next.js route
    const cookieHeader = request.headers.get('cookie') ?? '';

    const backendUrl =
      `${BACKEND_URL}/v1/documents/${encodeURIComponent(document_id)}/content`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    const body = await response.arrayBuffer();

    const headers = new Headers();

    headers.set(
      'Content-Type',
      response.headers.get('content-type') || 'application/octet-stream'
    );

    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      headers.set('Content-Disposition', contentDisposition);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new NextResponse(body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error('❌ Frontend proxy document-content error:', error);

    return NextResponse.json(
      { error: 'Không thể tải file từ backend.' },
      { status: 500 }
    );
  }
}