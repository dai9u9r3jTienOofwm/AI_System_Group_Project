import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL =
  process.env.INTERNAL_API_URL || 'http://backend:8000';

type ProxyBody = {
  endpoint?: string;
  data?: unknown;
  method?: string;
};

const isConnectionRefused = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if ('code' in value && (value as { code?: string }).code === 'ECONNREFUSED') return true;
  if ('errors' in value && Array.isArray((value as { errors?: unknown[] }).errors)) {
    return (value as { errors?: unknown[] }).errors?.some(isConnectionRefused) ?? false;
  }
  return false;
};

async function handler(req: NextRequest) {
  let endpoint: string | null = null;
  try {
    let method = req.method;
    let data: unknown = null;

    if (method === 'GET') {
      const searchParams = req.nextUrl.searchParams;
      endpoint = searchParams.get('endpoint');
      searchParams.delete('endpoint');
      const remaining = searchParams.toString();
      if (remaining) endpoint = `${endpoint}?${remaining}`;
    } else {
      try {
        const text = await req.text();
        if (text) {
          const body = JSON.parse(text) as ProxyBody;
          endpoint = body.endpoint || null;
          data = body.data;
          method = body.method || method;
        }
      } catch {
        // no JSON body
      }
    }

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    // Backend API dùng /v1/ prefix, không phải /api/
    const url = `${BACKEND_API_URL}/v1/${endpoint.replace(/^\/+/, '')}`;

    const headers: HeadersInit = {
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    };

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: data ? JSON.stringify(data) : undefined,
      cache: 'no-store',
    });

    let responseData: unknown = null;
    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    if (rawText) {
      if (contentType.includes('application/json')) {
        try {
          responseData = JSON.parse(rawText);
        } catch {
          responseData = { message: rawText };
        }
      } else {
        responseData = { message: rawText };
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend error', status: response.status, data: responseData },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown error';
    const cause =
      typeof error === 'object' && error !== null && 'cause' in error
        ? (error as { cause?: unknown }).cause
        : undefined;

    if (isConnectionRefused(cause)) {
      if (endpoint === '/ingest-status' || endpoint === '/ingest/status') {
        return NextResponse.json(
          { status: 'idle', progress: 0, message: 'Backend offline' },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: 'Backend unavailable', details: `Unable to reach ${BACKEND_API_URL}` },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: 'Internal server error', details }, { status: 500 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
