const fetch = require('node-fetch');

const apiKey = process.env.GEMINI_API_KEY || 'dummy';

async function testModel(model) {
  console.log(`Testing model ${model}...`);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hello, respond with one word.' }] }]
      })
    });
    console.log(`Status for ${model}:`, response.status);
    const text = await response.text();
    console.log(`Response for ${model}:`, text.slice(0, 200));
  } catch (err) {
    console.error(`Failed for ${model}:`, err.message);
  }
}

async function run() {
  await testModel('gemini-2.5-flash');
  await testModel('gemini-1.5-flash');
  await testModel('gemini-1.5-pro');
}

run();
