export async function POST(req: Request) {
  try {
    const { messages, documentIds } = await req.json();

    const pythonBackendUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';

    const response = await fetch(`${pythonBackendUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, document_ids: documentIds ?? [] }),
    });

    if (!response.ok) {
      throw new Error(`Backend trả về lỗi: ${response.status}`);
    }

    const data = await response.json();

    return Response.json({
      answer: data.answer ?? data.content ?? '',
      sources: data.sources ?? [],
    });
  } catch (error) {
    console.error('API Chat Error:', error);
    return Response.json(
      { error: 'Lỗi kết nối đến máy chủ AI.' },
      { status: 500 }
    );
  }
}
