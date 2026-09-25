// Logs the exact function-call args the model sends, to see why "#1" misses.
import 'dotenv/config';

const k = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-flash-lite-latest';
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${k}`;

const tools = [{
  functionDeclarations: [{
    name: 'get_my_complaint_status',
    description: 'Look up the signed-in citizen\'s OWN complaints and their current status. Pass no argument to list all of their complaints, or a complaint_id to check one specific complaint.',
    parameters: { type: 'object', properties: { complaint_id: { type: 'string', description: 'Optional: the numeric complaint id, e.g. "42".' } } }
  }]
}];

const sys = { parts: [{ text: 'You are a test harness. When asked about a complaint, call get_my_complaint_status. Echo nothing else.' }] };

const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    systemInstruction: sys,
    contents: [{ role: 'user', parts: [{ text: 'Tell me about complaint #1' }] }],
    tools
  })
});
const j = await r.json();
console.log('status:', r.status);
const parts = j.candidates?.[0]?.content?.parts || [];
console.log('parts:', JSON.stringify(parts, null, 2));
const fc = parts.find((p) => p.functionCall);
if (fc) console.log('\n>>> MODEL SENT ARGS:', JSON.stringify(fc.functionCall.args));
process.exit(0);
