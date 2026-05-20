import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL =
  process.env.INTERNAL_API_URL || 'http://backend:8000';;

type ProxyBody = {
  endpoint?: string;
  data?: unknown;
  method?: string;
};

const isConnectionRefused = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  if ('code' in value && (value as { code?: string }).code === 'ECONNREFUSED') {
    return true;
  }

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

    // 🔥 1. SỬA LỖI CHO GET: Giữ lại toàn bộ tham số truy vấn
    if (method === "GET") {
      const searchParams = req.nextUrl.searchParams;
      endpoint = searchParams.get("endpoint");

      // Xóa 'endpoint' khỏi danh sách params vì ta đã lấy nó rồi
      searchParams.delete("endpoint");
      
      // Nếu còn các tham số khác (ví dụ: ?id=1&status=active), ta gắn nó vào lại endpoint
      const remainingParams = searchParams.toString();
      if (remainingParams) {
        endpoint = `${endpoint}?${remainingParams}`;
      }
    } 
    // 🔥 2. SỬA LỖI CHO CÁC METHOD KHÁC: Tránh lỗi khi body trống
    else {
      try {
        const textBody = await req.text(); // Đọc dạng chữ trước cho an toàn
        if (textBody) {
          const body = JSON.parse(textBody) as ProxyBody;
          endpoint = body.endpoint || null;
          data = body.data;
          method = body.method || method;
        }
      } catch {
        console.log("Không có body JSON hoặc body không hợp lệ");
      }
    }

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint is required" },
        { status: 400 }
      );
    }

    // Backend API dùng /v1/ prefix, không phải /api/
    const url = `${BACKEND_API_URL}/v1/${endpoint.replace(/^\/+/, "")}`;

    const headers: HeadersInit = {
      ...(data ? { "Content-Type": "application/json" } : {}),
    };

    // 🚀 Call backend
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: data ? JSON.stringify(data) : undefined,
      cache: "no-store", // 🔥 3. THÊM VÀO: Báo cho Next.js không được cache dữ liệu này
    });

    // 🧠 Parse response an toàn: đọc text trước rồi cố parse JSON để tránh json() ném khi body rỗng
    let responseData: unknown = null;
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    if (rawText) {
      if (contentType.includes("application/json")) {
        try {
          responseData = JSON.parse(rawText);
        } catch {
          // trả về raw text nếu JSON không hợp lệ
          responseData = { message: "Invalid JSON from backend", raw: rawText };
          console.warn("Proxy: failed to parse backend JSON", { url, status: response.status, rawText });
        }
      } else {
        responseData = { message: rawText };
      }
    } else {
      responseData = null;
    }

    // ❌ Nếu backend trả lỗi → xử lý theo loại endpoint
    if (!response.ok) {
      // Log backend response for easier debugging
      console.error("Proxy: backend returned error", { url, status: response.status, endpoint, data: responseData });

      // Nếu backend return 404 cho những endpoint không có sẵn, dùng mock data thay vì error
      if (response.status === 404) {
        // Mock data cho các endpoint chưa được implement
        if (endpoint?.includes('ingest-status') || endpoint?.includes('ingest/status')) {
          return NextResponse.json({
            status: 'idle',
            progress: 0,
            documents: [],
            message: 'Endpoint chưa được implement',
          }, { status: 200 });
        }

        if (endpoint?.includes('/users')) {
          // Mock users list
          return NextResponse.json([
            {
              id: '1',
              email: 'admin@example.com',
              username: 'Admin User',
              role: 'admin',
              is_active: true,
            },
          ], { status: 200 });
        }
      }

      return NextResponse.json(
        {
          error: "Backend error",
          status: response.status,
          data: responseData,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    const cause =
      typeof error === 'object' && error !== null && 'cause' in error
        ? (error as { cause?: unknown }).cause
        : undefined;

    if (isConnectionRefused(cause)) {
      if (endpoint === '/ingest-status' || endpoint === '/ingest/status') {
        return NextResponse.json(
          {
            status: 'idle',
            progress: 0,
            message: 'Backend offline',
          },
          { status: 200 }
        );
      }

      console.warn('Proxy: backend unavailable', { url: BACKEND_API_URL });

      return NextResponse.json(
        {
          error: 'Backend unavailable',
          details: `Unable to reach ${BACKEND_API_URL}`,
        },
        { status: 503 }
      );
    }

    console.error('Proxy error:', error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details,
      },
      { status: 500 }
    );
  }
}

// 🔥 map tất cả method
export { handler as GET, handler as POST, handler as PUT, handler as DELETE };