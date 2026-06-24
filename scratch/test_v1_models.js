const fetch = require('node-fetch');

const apiKey = process.env.GEMINI_API_KEY || 'dummy';

async function testModelUrl(url, name) {
  console.log(`Testing ${name}...`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello, respond with one word.' }] }]
      })
    });
    console.log(`Status for ${name}:`, response.status);
    const text = await response.text();
    console.log(`Response for ${name}:`, text.slice(0, 200));
  } catch (err) {
    console.error(`Failed for ${name}:`, err.message);
  }
}

async function run() {
  await testModelUrl(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, 'v1 gemini-1.5-flash');
  await testModelUrl(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, 'v1beta gemini-1.5-flash');
  await testModelUrl(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`, 'v1 gemini-2.5-flash');
  await testModelUrl(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, 'v1beta gemini-2.5-flash');
}

run();
