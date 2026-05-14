export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const pythonUrl = process.env.PYTHON_API_URL ?? 'http://localhost:8000';

    const response = await fetch(`${pythonUrl}/v1/admin/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Backend error: ${response.status}`);

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Upload proxy error:', error);
    return Response.json({ error: 'Tải lên thất bại. Vui lòng thử lại.' }, { status: 500 });
  }
}
