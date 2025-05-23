import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new Response('Missing url', { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'text/html' }
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(text, { status: res.status, statusText: res.statusText });
    }

    const text = await res.text();
    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return new Response('Proxy error', { status: 500 });
  }
}
