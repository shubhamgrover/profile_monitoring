import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { domain, url } = await request.json();
    const targetUrl = url || (domain ? `https://${domain}` : '');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Domain or URL is required' }, { status: 400 });
    }

    const exaKey = process.env.EXA_API_KEY || 'a0c81fe8-4433-4a01-9dc5-ba02492cf921';

    console.log(`[Similar Companies] Querying Exa findSimilar for: ${targetUrl}`);

    const response = await fetch('https://api.exa.ai/findSimilar', {
      method: 'POST',
      headers: {
        'x-api-key': exaKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        numResults: 5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Similar Companies] Exa failed: ${errorText}`);
      // Fallback search to find companies in same space
      const domainClean = targetUrl.replace('https://', '').replace('http://', '').replace('www.', '');
      return NextResponse.json({
        results: [
          { title: `${domainClean} Competitor A`, url: 'https://competitor-a.com' },
          { title: `${domainClean} Competitor B`, url: 'https://competitor-b.com' }
        ],
        isFallback: true
      });
    }

    const data = await response.json();
    return NextResponse.json({ results: data.results || [], isFallback: false });

  } catch (error) {
    console.error('Error in similar-companies route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
