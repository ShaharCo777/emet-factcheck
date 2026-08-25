// Emet proxy - Cloudflare Worker
// מחזיק את מפתחות ה-API ומעביר בקשות מהתוסף ל-Groq (תמלול + מודל) ול-Serper (חיפוש).
// כך משתמשי הקצה לא צריכים מפתח משלהם - הכול על החשבון שלך, עם תקרות הוצאה מובנות.
//
// סודות שצריך להגדיר (ראו proxy/README.md):
//   GROQ_API_KEY   - מ-console.groq.com
//   SERPER_API_KEY - מ-serper.dev
// אופציונלי: KV בשם EMET_KV להגבלת קצב (מומלץ מאוד - בלעדיו אין תקרה).

// ── תקרות הוצאה (שנו לפי התקציב שלכם) ────────────────────────────────────────
const DAILY_IP_LIMIT     = 400;    // בקשות ליום לכל משתמש (IP) - מונע ניצול של יחיד
const DAILY_GLOBAL_LIMIT = 30000;  // תקרת בקשות יומית כוללת - הגבול העליון להוצאה שלך
// אומדן: ~140 בקשות = שעת בדיקה. 30,000/יום ≈ 210 שעות-משתמש ליום ≈ ~$50/יום מקסימום.

// דגמי Llama הוצאו משימוש ב-Groq (יוני 2026). gpt-oss-120b הוא דגם הפרודקשן המומלץ.
// לחיסכון: אפשר להחליף ל-'openai/gpt-oss-20b' (זול/מהיר יותר, איכות מעט נמוכה).
const GROQ_LLM_MODEL   = 'openai/gpt-oss-120b';
const GROQ_STT_MODEL   = 'whisper-large-v3-turbo';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ניסיון חוזר עם השהיה על שגיאות זמניות (429/503/5xx) - מוריד דרמטית את ה-503
// שמגיעים מהמכסה החינמית העמוסה של Groq.
async function fetchWithRetry(url, opts, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
      continue;
    }
    if (res.status !== 429 && res.status !== 503 && res.status < 500) return res;
    if (i === retries) return res;
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
}

async function withinRateLimit(env, ip) {
  if (!env.EMET_KV) return true; // ללא KV אין הגבלה - הגדירו KV בפרודקשן!
  const day = new Date().toISOString().slice(0, 10);
  const ipKey = `rl:${ip}:${day}`;
  const gKey  = `rl:global:${day}`;
  const [ipCount, gCount] = await Promise.all([
    env.EMET_KV.get(ipKey).then(v => parseInt(v || '0', 10)),
    env.EMET_KV.get(gKey).then(v => parseInt(v || '0', 10)),
  ]);
  if (ipCount >= DAILY_IP_LIMIT || gCount >= DAILY_GLOBAL_LIMIT) return false;
  await Promise.all([
    env.EMET_KV.put(ipKey, String(ipCount + 1), { expirationTtl: 172800 }),
    env.EMET_KV.put(gKey,  String(gCount + 1),  { expirationTtl: 172800 }),
  ]);
  return true;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== 'POST')   return json({ error: 'post_only' }, 405);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!(await withinRateLimit(env, ip))) {
      return json({ error: 'rate_limited', message: 'הגעתם למכסה היומית של השירות המשותף. נסו שוב מחר, או הזינו מפתח API משלכם בהגדרות המתקדמות של התוסף.' }, 429);
    }

    const path = new URL(request.url).pathname;
    try {
      if (path === '/transcribe') return await handleTranscribe(request, env);
      if (path === '/chat')       return await handleChat(request, env);
      if (path === '/search')     return await handleSearch(request, env);
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      return json({ error: 'proxy_error', message: String(e && e.message || e) }, 500);
    }
  },
};

// ── תמלול: WAV גולמי -> Groq Whisper ─────────────────────────────────────────
async function handleTranscribe(request, env) {
  const audio = await request.arrayBuffer();
  if (audio.byteLength > 3_000_000) return json({ error: 'audio_too_large' }, 413);

  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/wav' }), 'chunk.wav');
  form.append('model', GROQ_STT_MODEL);
  form.append('language', 'he');
  form.append('response_format', 'text');

  const res = await fetchWithRetry('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
    body: form,
  });
  if (!res.ok) return json({ error: 'stt_failed', status: res.status, message: await res.text() }, 502);
  const text = (await res.text()).trim();
  return json({ text });
}

// ── מודל שפה: זיהוי טענות / אימות ─────────────────────────────────────────────
// אם הוגדר מפתח Gemini (wrangler secret put GEMINI_API_KEY) - משתמשים בו:
// איכות עברית טובה בהרבה מ-gpt-oss, ומכסה חינמית יציבה יותר. אחרת - Groq.
async function handleChat(request, env) {
  const { system, user } = await request.json();
  if (env.GEMINI_API_KEY) return chatGemini(env, system, user);
  return chatGroq(env, system, user);
}

async function chatGemini(env, system, user) {
  const res = await fetchWithRetry('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: String(system || '') }] },
      contents: [{ role: 'user', parts: [{ text: String(user || '') }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  const data = await res.json();
  if (data.error) return json({ error: 'llm_failed', message: data.error.message || 'Gemini error' }, 502);
  const text = (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text || '').join('').trim();
  return json({ text });
}

async function chatGroq(env, system, user) {
  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.GROQ_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_LLM_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: String(system || '') },
        { role: 'user',   content: String(user || '') },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) return json({ error: 'llm_failed', message: data.error.message || 'LLM error' }, 502);
  return json({ text: (data.choices?.[0]?.message?.content || '').trim() });
}

// ── חיפוש: Serper (Google, ישראל) ────────────────────────────────────────────
async function handleSearch(request, env) {
  const { query } = await request.json();
  const res = await fetchWithRetry('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': env.SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: String(query || ''), gl: 'il', hl: 'iw', num: 6 }),
  });
  const data = await res.json();
  return json(data);
}
