const fetch = require('node-fetch');

async function test() {
  const payload = {
    companyName: 'Whatfix',
    domain: 'whatfix.com',
    targetDept: 'Marketing',
    targetSeniority: 'VP',
    snapData: {
      jobOpenings: [{ title: 'Senior Growth Manager', location: 'Remote' }],
      posts: [{ text: 'We just hit a new scaling milestone!' }],
      prMentions: [{ title: 'Whatfix recognized in tech review' }],
      redditMentions: [{ title: 'Whatfix tool discussion' }]
    }
  };

  console.log('Sending request to /api/correlate...');
  try {
    const res = await fetch('http://localhost:3000/api/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('Response status:', res.status);
    const data = await res.json();
    console.log('Response keys:', Object.keys(data));
    console.log('strategicCorrelations:', JSON.stringify(data.strategicCorrelations, null, 2));
    console.log('companyPosts length:', data.companyPosts?.length);
    console.log('resolvedContacts:', JSON.stringify(data.resolvedContacts, null, 2));
  } catch (err) {
    console.error('Test request failed:', err);
  }
}

test();
