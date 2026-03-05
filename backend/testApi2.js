const axios = require('axios');
const PROMPT = 'You are a privacy policy analyst. Analyze "example.com". Return JSON.';
const SYSTEM_PROMPT = `You are a privacy policy analyst. You read privacy policies and return a structured JSON analysis. Always respond with valid JSON only — no markdown, no explanation outside the JSON.`;
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSyCeDslg93zYcT0hsOd19tPWROcULyhc7vw`;

axios.post(endpoint, {
    contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${PROMPT}` }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
}).then(res => {
    require('fs').writeFileSync('rawRawOut.txt', res.data.candidates[0].content.parts[0].text);
    console.log('done');
}).catch(console.error);
