export async function GET() {
  try {
    const pythonUrl = process.env.INTERNAL_API_URL || 'http://backend:8000';
    const response = await fetch(`${pythonUrl}/v1/documents`, { cache: 'no-store' });

    if (!response.ok) throw new Error(`Backend error: ${response.status}`);

    const data = await response.json();
    return Response.json({ documents: Array.isArray(data) ? data : [] });
  } catch {
    // Backend chưa sẵn sàng — trả về rỗng thay vì lỗi
    return Response.json({ documents: [] });
  }
}
