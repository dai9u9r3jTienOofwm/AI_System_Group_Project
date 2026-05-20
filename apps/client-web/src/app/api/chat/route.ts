export async function POST(req: Request) {
  try {
    const { messages, documentIds } = await req.json();

    const pythonBackendUrl = process.env.INTERNAL_API_URL || 'http://backend:8000';

    const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : "";

    const response = await fetch(`${pythonBackendUrl}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({question: lastMessage, top_k: 5}),
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
