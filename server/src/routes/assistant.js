import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireCitizen } from '../middleware/auth.js';
import faqData from '../../../web/src/data/faqData.js';

const router = Router();

const apiKey = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-flash-lite-latest';

// ── System prompt ─────────────────────────────────────────────────
// Grounded in the live FAQ file (imported, never duplicated). English +
// Bangla entries are both injected so the assistant can answer in the
// citizen's own language.
const faqBlock = faqData
  .map((item) =>
    `Q: ${item.question.en}\nA: ${item.answer.en}\n` +
    `Q (বাংলা): ${item.question.bn}\nA (বাংলা): ${item.answer.bn}`
  )
  .join('\n\n');

const SYSTEM_PROMPT = `You are the Nagorik Sheba (নাগরিক সেবা) citizen assistant — a helpful, concise guide to the Nagorik Sheba municipal complaint platform.

SCOPE — answer ONLY questions about:
1. How to use the Nagorik Sheba app (registration, face verification, submitting complaints, voting, the AI agent pipeline, emergency services, maps, languages, notifications, the dashboard).
2. How the complaint workflow works (Junior Staff → Senior Staff → Mayor/Chairman → Work Inspection Team → Field Staff, including rejections, ETA, resolution confirmation/dispute).
3. The signed-in citizen's OWN complaint status — use the get_my_complaint_status tool for this; never guess a status or date.

If a question is about anything else (general knowledge, other apps, politics, etc.), politely decline in one short sentence and redirect to Nagorik Sheba topics.

RULES
- Reply in the same language the citizen wrote in (English or বাংলা).
- Be concise and friendly. No long paragraphs unless the citizen asks for detail.
- Never invent statuses, dates, complaint IDs, workflow steps, or features. If you are unsure or the FAQ below does not cover it, say so honestly instead of guessing.
- For any complaint-status question, call get_my_complaint_status rather than answering from memory. If the tool returns no matching complaint, tell the citizen you could not find that complaint under their account (do not reveal any other citizen's data).
- You do not know the citizen's identity beyond what the tool returns; never claim to see other users' complaints.

KNOWLEDGE BASE (authoritative FAQ — answers must stay consistent with this):
${faqBlock}`;

// ── Tool: get_my_complaint_status ─────────────────────────────────
// SECURITY: the query is scoped to the authenticated citizen's id,
// taken from req.auth.id (JWT). A user_id supplied by the model or the
// client is NEVER used — it is not even part of the function schema.
function myComplaintStatus(authId, complaintId) {
  const params = [authId];
  let sql = `
    SELECT c.complaint_id, c.title, c.category, c.status,
           c.created_at AS submitted_at, c.updated_at,
           (SELECT sh.changed_at FROM status_history sh
             WHERE sh.complaint_id = c.complaint_id
             ORDER BY sh.changed_at DESC LIMIT 1) AS last_trail_at
    FROM complaints c
    WHERE c.user_id = ?`;
  if (complaintId) {
    sql += ' AND c.complaint_id = ?';
    params.push(complaintId);
  }
  sql += ' ORDER BY c.created_at DESC LIMIT 20';

  return db.prepare(sql).all(...params).map((c) => ({
    complaint_id: c.complaint_id,
    title: c.title,
    category: c.category,
    status: c.status,
    submitted_at: c.submitted_at,
    last_update: c.last_trail_at || c.updated_at
  }));
}

// Gemini function/tool declaration
const tools = [
  {
    functionDeclarations: [
      {
        name: 'get_my_complaint_status',
        description:
          'Look up the signed-in citizen\'s OWN complaints and their current status. Pass no argument to list all of their complaints, or a complaint_id to check one specific complaint. Only the citizen\'s own complaints are ever returned.',
        parameters: {
          type: 'object',
          properties: {
            complaint_id: {
              type: 'string',
              description: 'Optional: the numeric complaint id to look up, e.g. "42". Omit to list all of the citizen\'s complaints.'
            }
          }
        }
      }
    ]
  }
];
function executeTool(name, args, authId) {
  if (name !== 'get_my_complaint_status') {
    return { error: 'Unknown tool' };
  }
  const raw = args?.complaint_id;
  const complaintId = /^\d+$/.test(String(raw ?? '').trim()) ? Number(String(raw).trim()) : null;
  return { complaints: myComplaintStatus(authId, complaintId) };
}

// ── POST /api/assistant/chat ─────────────────────────────────────
router.post('/chat', requireAuth, requireCitizen, async (req, res) => {
  const { message, conversation_history = [] } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required' });
  }
  if (!Array.isArray(conversation_history)) {
    return res.status(400).json({ error: 'conversation_history must be an array' });
  }

  if (!apiKey) {
    return res.status(503).json({
      error: 'The assistant is not configured. The server needs a GEMINI_API_KEY (see server/.env).'
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  // The REST API expects systemInstruction as a Content object, not a string.
  const systemInstruction = { parts: [{ text: SYSTEM_PROMPT }] };

  // Gemini chat history: alternate user/model turns.
  const history = conversation_history
    .filter((t) => t && (t.role === 'user' || t.role === 'model') && typeof t.text === 'string')
    .map((t) => ({ role: t.role, parts: [{ text: t.text }] }));

  const baseContents = [
    ...history,
    { role: 'user', parts: [{ text: message.trim() }] }
  ];

  try {
    // Straightforward function-calling loop for a single tool:
    // send → if the model calls the tool, execute it and feed the result
    // back → return the model's final natural-language answer.
    const first = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents: baseContents,
        tools
      })
    });
    const firstJson = await first.json();
    if (!first.ok) {
      console.error('Assistant Gemini error:', JSON.stringify(firstJson.error || firstJson).slice(0, 500));
      return res.status(502).json({ error: 'The assistant could not be reached. Please try again later.' });
    }

    const candidate = firstJson.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const fnCall = parts.find((p) => p.functionCall);
    if (!fnCall) {
      const text = parts.map((p) => p.text).filter(Boolean).join('');
      return res.json({ reply: text || '' });
    }

    // SECURITY: req.auth.id is the ONLY identity used — never call args.
    const toolOutput = executeTool(fnCall.functionCall.name, fnCall.functionCall.args, req.auth.id);

    const followUp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents: [
          ...baseContents,
          { role: 'model', parts: [fnCall] },
          { role: 'user', parts: [{ functionResponse: { name: fnCall.functionCall.name, response: toolOutput } }] }
        ],
        tools
      })
    });
    const followUpJson = await followUp.json();
    if (!followUp.ok) {
      console.error('Assistant Gemini follow-up error:', JSON.stringify(followUpJson.error || followUpJson).slice(0, 500));
      return res.status(502).json({ error: 'The assistant could not be reached. Please try again later.' });
    }

    const replyParts = followUpJson.candidates?.[0]?.content?.parts || [];
    const reply = replyParts.map((p) => p.text).filter(Boolean).join('');
    res.json({ reply });
  } catch (err) {
    console.error('Assistant error:', err?.message || err);
    res.status(502).json({ error: 'The assistant could not be reached. Please try again later.' });
  }
});

export default router;
