import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const apiKey = request.headers.get('x-api-key') || process.env.SCRAPECREATORS_API_KEY || 'cwG38owB6JPGD6YMF5VhTfrAeBn2';

  const endpoint = type === 'company'
    ? `https://api.scrapecreators.com/v1/linkedin/company?url=${encodeURIComponent(url)}`
    : `https://api.scrapecreators.com/v1/linkedin/profile?url=${encodeURIComponent(url)}`;

  try {
    console.log(`[Proxy] Routing ${type} scrape for URL: ${url}`);
    const response = await fetch(endpoint, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `ScrapeCreators error: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[Proxy] Fetch failed for ${url}:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
