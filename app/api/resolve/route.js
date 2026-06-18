import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { companyName, apiKey } = await request.json();

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'Exa API key is required' }, { status: 400 });
    }

    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `linkedin.com/company/ ${companyName}`,
        includeDomains: ['linkedin.com'],
        numResults: 5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Exa API error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
