const fetch = require('node-fetch');

async function testCorrelate() {
  for (const company of ['Atlys', 'Dentsu']) {
    console.log(`\n=== Calling /api/correlate for ${company} ===`);
    const res = await fetch('http://localhost:3000/api/correlate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: company,
        domain: company.toLowerCase() + '.com',
        targetDept: 'Marketing',
        targetSeniority: 'VP'
      })
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data keys:", Object.keys(data));
    console.log("founderContact:", data.founderContact);
    console.log("marketingContact:", data.marketingContact);
  }
}

testCorrelate();
