const fetch = require('node-fetch');

async function test() {
  const payload = {
    companyName: 'Doceree',
    domain: 'doceree.com',
    snapData: {
      jobOpenings: [],
      sitemapLinks: [],
      prMentions: []
    },
    targetDept: 'Marketing',
    targetSeniority: 'VP',
    gtmSettings: {
      productName: 'SignalEngine',
      productDesc: 'B2B GTM Signals Dashboard',
      competitors: 'Outreach, ZoomInfo'
    }
  };

  try {
    console.log('Sending request to /api/correlate...');
    const res = await fetch('http://localhost:3000/api/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Response status:', res.status);
    const data = await res.json();
    console.log('Response JSON:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
