const fetch = require('node-fetch'); // wait, node-fetch might not be installed, we can use built-in fetch if node version is high enough (which it is,React 19/Next 16 uses Node 18+)

async function testBuyingCommittee() {
  const res = await fetch('http://localhost:3000/api/collectors/buying-committee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: 'Atlys', department: 'Marketing', seniority: 'VP' })
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", JSON.stringify(data, null, 2));
}

testBuyingCommittee();
