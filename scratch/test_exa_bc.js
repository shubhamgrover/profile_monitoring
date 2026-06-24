const fetch = require('node-fetch');

async function testExaDirect() {
  const query = 'site:linkedin.com/in/ "Atlys" (VP OR "Vice President" OR "Head") (Marketing OR Brand OR Growth OR PR OR Communications OR CMO)';
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': 'a0c81fe8-4433-4a01-9dc5-ba02492cf921',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: query,
      includeDomains: ['linkedin.com'],
      numResults: 4,
    }),
  });
  const data = await res.json();
  console.log("Exa Results:", JSON.stringify(data.results, null, 2));
}

testExaDirect();
