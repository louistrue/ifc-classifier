import { NextRequest } from 'next/server';

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36',
  Accept: 'text/html',
  'Accept-Language': 'en'
};

async function fetchHtml(url: string, method: 'GET' | 'HEAD') {
  const res = await fetch(url, { method, headers: DEFAULT_HEADERS });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new Response('Missing url', { status: 400 });
  }

  try {
    return await fetchHtml(url, 'GET');
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return new Response('Proxy error', { status: 500 });
  }
}

export async function HEAD(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new Response('Missing url', { status: 400 });
  }

  try {
    return await fetchHtml(url, 'HEAD');
  } catch (error) {
    console.error('Proxy fetch failed:', error);
    return new Response('Proxy error', { status: 500 });
  }
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
