import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const lowerUrl = url.toLowerCase();

    // Special check for YouTube links: validate existence via oEmbed API
    if (lowerUrl.includes('youtube.com/') || lowerUrl.includes('youtu.be/')) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}`;
        const response = await fetch(oembedUrl);
        return NextResponse.json({ valid: response.ok, status: response.status });
      } catch (err) {
        return NextResponse.json({ valid: false, error: err.message });
      }
    }

    // Bypass server-side check for major platforms that block server requests (e.g. 403, 999)
    const bypassDomains = ['linkedin.com', 'twitter.com', 'x.com', 'reddit.com', 'techcrunch.com'];
    if (bypassDomains.some(domain => lowerUrl.includes(domain))) {
      return NextResponse.json({ valid: true, bypassed: true });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Status 2xx and 3xx are valid
      const isValid = response.status >= 200 && response.status < 400;
      return NextResponse.json({ valid: isValid, status: response.status });
    } catch (err) {
      clearTimeout(timeoutId);
      return NextResponse.json({ valid: false, error: err.message });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
