// Integration test: drives the Emet service-worker pipeline with mocked chrome + fetch.
// Run: node test/pipeline-test.js
const fs = require('fs');
const path = require('path');
const SW = path.join(__dirname, '..', 'src', 'background', 'service-worker.js');

let failures = 0;
function assert(cond, name) {
  if (cond) console.log('  PASS:', name);
  else { failures++; console.error('  FAIL:', name); }
}

const sentToTab = [];
const sentToRuntime = [];
let onMessageListener = null;

const storageData = {
  anthropicKey: 'sk-ant-test', deepgramKey: 'dg-test',
  geminiKey: 'AIza-test', groqKey: 'gsk-test',
  brightdataKey: 'bd-test', brightdataZone: 'serp_api', claudeModel: 'claude-haiku-4-5',
};

const sessionStore = { data: {} };
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => cb(storageData),
      set: (obj, cb) => { Object.assign(storageData, obj); if (cb) cb(); },
    },
    session: {
      set(obj) { Object.assign(sessionStore.data, obj); return Promise.resolve(); },
      get(key) { return Promise.resolve({ [key]: sessionStore.data[key] }); },
      remove(key) { delete sessionStore.data[key]; return Promise.resolve(); },
    },
  },
  runtime: {
    onConnect: { addListener() {} },
    onStartup: { addListener() {} },
    onMessage: { addListener(fn) { onMessageListener = fn; } },
    sendMessage: (msg) => { sentToRuntime.push(msg); return Promise.resolve({ ok: true }); },
    getURL: p => 'chrome-extension://test/' + p,
    getContexts: async () => [{}],
    getPlatformInfo: (cb) => cb && cb({}),
  },
  tabs: {
    query: async () => [{ id: 42 }],
    sendMessage: (tabId, msg) => { sentToTab.push(msg); return Promise.resolve(); },
  },
  tabCapture: { getMediaStreamId: (opts, cb) => cb('stream-123') },
  offscreen: { createDocument: async () => {}, closeDocument: async () => {} },
};

const fetchLog = [];
let anthClaim = 'האבטלה בישראל עומדת על 3 אחוזים';
let groqClaim = 'תקציב החינוך גדל בעשרה מיליארד שקל';
let anthropicPauseOnce = false;
let groqGroundedUnverifiable = false;
let anthGroundedFalse = false;

const mkResult = (claim, verdict, confidence) => ({
  claim, verdict, confidence,
  explanation: 'הסבר בעברית לבדיקה.', speaker: null, speaker_confidence: 'MEDIUM',
});

global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  fetchLog.push({ url, body });

  if (url.includes('api.anthropic.com')) {
    if (body.tools) {
      if (anthropicPauseOnce) {
        anthropicPauseOnce = false;
        return { json: async () => ({ stop_reason: 'pause_turn', content: [
          { type: 'server_tool_use', id: 'st1', name: 'web_search', input: { query: 'x' } },
          { type: 'web_search_tool_result', content: [{ url: 'https://www.cbs.gov.il/pause' }] },
        ] }) };
      }
      const gv = anthGroundedFalse ? 'FALSE' : 'SUBSTANTIALLY TRUE';
      return { json: async () => ({ stop_reason: 'end_turn', content: [
        { type: 'web_search_tool_result', content: [
          { url: 'https://www.cbs.gov.il/abtala', title: 'הלמ"ס' },
          { url: 'https://rotter.net/scoop', title: 'רוטר' },
          { url: 'javascript:alert(1)', title: 'זדוני' },
          { url: 'https://www.calcalist.co.il/x', title: 'כלכליסט' },
        ] },
        { type: 'text', text: JSON.stringify([mkResult(anthClaim, gv, 'HIGH')]) },
      ] }) };
    }
    return { json: async () => ({ content: [{ type: 'text', text: '```json\n' + JSON.stringify([mkResult(anthClaim, 'TRUE', 'MEDIUM')]) + '\n```' }] }) };
  }

  if (url.includes('generativelanguage.googleapis.com')) {
    if (body.tools) {
      return { json: async () => ({ candidates: [{
        content: { parts: [{ text: JSON.stringify([mkResult('ישראל קלטה כמיליון עולים בשנות התשעים', 'TRUE', 'HIGH')]) }] },
        groundingMetadata: { groundingChunks: [
          { web: { uri: 'https://vertexaisearch.cloud.google.com/redirect/1', title: 'cbs.gov.il' } },
          { web: { uri: 'https://vertexaisearch.cloud.google.com/redirect/2', title: 'rotter.net' } },
        ] },
      }] }) };
    }
    return { json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify([mkResult('ישראל קלטה כמיליון עולים בשנות התשעים', 'TRUE', 'HIGH')]) }] } }] }) };
  }

  if (url.includes('api.groq.com')) {
    const userMsg = body.messages.find(m => m.role === 'user')?.content || '';
    if (userMsg.includes('Web search evidence')) {
      const verdict = groqGroundedUnverifiable ? 'UNVERIFIABLE' : 'SUBSTANTIALLY TRUE';
      return { json: async () => ({ choices: [{ message: { content: JSON.stringify([mkResult(groqClaim, verdict, 'MEDIUM')]) } }] }) };
    }
    return { json: async () => ({ choices: [{ message: { content: JSON.stringify([mkResult(groqClaim, 'TRUE', 'MEDIUM')]) } }] }) };
  }

  if (url.includes('api.brightdata.com')) {
    return { ok: true, json: async () => ({
      organic: [
        { link: 'https://www.cbs.gov.il/data', title: 'נתוני הלמ"ס', description: 'נתונים רשמיים', rank: 1 },
        { link: 'https://facebook.com/post', title: 'blocked', description: 'x', rank: 2 },
        { link: 'https://www.themarker.com/x', title: 'דה-מרקר', description: 'ניתוח', rank: 3 },
      ],
      knowledge_graph: { name: 'תקציב החינוך', description: 'נתוני תקציב' },
    }) };
  }

  if (url.includes('workers.dev')) {
    if (url.endsWith('/chat')) {
      const u = body.user || '';
      const v = u.includes('Web search evidence') ? 'SUBSTANTIALLY TRUE' : 'TRUE';
      return { ok: true, json: async () => ({ text: JSON.stringify([mkResult('טענת שרת מאומתת על התקציב', v, 'MEDIUM')]) }) };
    }
    if (url.endsWith('/search')) {
      return { ok: true, json: async () => ({ organic: [
        { link: 'https://www.cbs.gov.il/x', title: 'הלמס', snippet: 'נתון' },
        { link: 'https://rotter.net/y', title: 'רוטר', snippet: 'שמועה' },
        { link: 'https://www.calcalist.co.il/z', title: 'כלכליסט', snippet: 'ניתוח' },
      ] }) };
    }
  }

  throw new Error('unexpected fetch: ' + url);
};

// simulate a deployed proxy by filling the CHANGE-ME placeholder
let SW_SRC = fs.readFileSync(SW, 'utf8')
  .replace('emet-proxy.CHANGE-ME.workers.dev', 'emet-proxy.test.workers.dev');
eval(SW_SRC);

const settle = () => new Promise(r => setTimeout(r, 50));
const feed = (sentences) => {
  for (const s of sentences) onMessageListener({ type: 'TRANSCRIPT_RESULT', text: s, isFinal: true, interim: false, speaker: 0 }, {}, () => {});
};
const start = () => new Promise(res => onMessageListener({ type: 'START_FACTCHECK' }, {}, res));
const stop  = () => onMessageListener({ type: 'STOP_FACTCHECK' }, {}, () => {});

(async () => {
  console.log('\n== 1. start flow (Claude BYO) ==');
  const r1 = await start();
  assert(r1.ok === true, 'START_FACTCHECK responds ok');
  assert(sentToRuntime.some(m => m.type === 'START_CAPTURE' && m.deepgramKey === 'dg-test'), 'deepgram key passed in START_CAPTURE');
  assert(sessionStore.data.emetSession?.isCapturing === true, 'MV3: session persisted on start');

  onMessageListener({ type: 'PAGE_TITLE', title: 'העימות המלא: נתניהו מול לפיד', date: '1 בינואר 2025' }, {}, () => {});

  console.log('\n== 3. Claude native web search ==');
  feed(['ערב טוב לכולם', 'אני רוצה לדבר על הכלכלה', 'האבטלה בישראל עומדת על שלושה אחוזים', 'וזה ההישג הגדול של הממשלה']);
  await settle();
  const gm = sentToTab.find(m => m.type === 'UPDATE_VERDICTS');
  assert(!!gm && gm.results[0].pending === false, 'grounded card final');
  assert(gm.results[0].sources.length === 2 && gm.results[0].sources.every(u => u.startsWith('https://')), 'blocked + javascript: URLs filtered');
  stop();
  assert(sessionStore.data.emetSession === undefined, 'MV3: session cleared on stop');

  console.log('\n== 9. Gemini native grounding ==');
  storageData.claudeModel = 'gemini:gemini-3.5-flash'; delete storageData.deepgramKey;
  sentToRuntime.length = 0;
  const r9 = await start();
  assert(r9.ok === true, 'Gemini starts without Deepgram key');
  const cap9 = sentToRuntime.find(m => m.type === 'START_CAPTURE');
  assert(cap9 && cap9.sttMode === 'gemini', 'gemini STT mode');
  stop();
  storageData.deepgramKey = 'dg-test';

  console.log('\n== 14. HOSTED mode (shared proxy, ZERO user keys) ==');
  storageData.claudeModel = 'hosted';
  delete storageData.deepgramKey; delete storageData.geminiKey; delete storageData.groqKey;
  delete storageData.anthropicKey; delete storageData.brightdataKey;
  sentToRuntime.length = 0;
  const r14 = await start();
  assert(r14.ok === true, 'hosted mode starts with ZERO user keys');
  const cap14 = sentToRuntime.find(m => m.type === 'START_CAPTURE');
  assert(cap14 && cap14.sttMode === 'hosted', 'STT routed to hosted proxy');
  assert(cap14 && cap14.proxyUrl.includes('workers.dev'), 'proxy URL passed to offscreen');
  sentToTab.length = 0; fetchLog.length = 0;
  feed(['שלום לכולם', 'הנתונים מדברים בעד עצמם', 'טענת שרת מאומתת על התקציב שגדל', 'וזה חשוב']);
  await settle();
  const proxyChat = fetchLog.filter(f => f.url.includes('workers.dev') && f.url.endsWith('/chat'));
  const proxySearch = fetchLog.filter(f => f.url.includes('workers.dev') && f.url.endsWith('/search'));
  assert(proxyChat.length >= 2, 'LLM calls via proxy /chat (got ' + proxyChat.length + ')');
  assert(proxySearch.length >= 1, 'search via proxy /search (got ' + proxySearch.length + ')');
  assert(fetchLog.filter(f => f.url.includes('anthropic') || f.url.includes('generativelanguage') || f.url.includes('groq.com') || f.url.includes('brightdata')).length === 0, 'NO direct AI calls in hosted mode');
  const hv = sentToTab.find(m => m.type === 'UPDATE_VERDICTS');
  assert(hv && hv.results[0].pending === false, 'verdict produced in hosted mode');
  assert(hv && hv.results[0].sources.length === 2 && hv.results[0].sources.every(u => !u.includes('rotter')), 'blocked source filtered from proxy results');

  console.log('\n== 15. GET_CONFIG exposes attribution + key help ==');
  let cfg;
  onMessageListener({ type: 'GET_CONFIG' }, {}, (r) => { cfg = r; });
  assert(cfg && typeof cfg.attributionUrl === 'string', 'GET_CONFIG returns attribution');
  assert(cfg && cfg.hostedAvailable === true, 'hostedAvailable true when proxy configured');
  assert(cfg && cfg.keyHelpUrl.includes('aistudio'), 'GET_CONFIG returns key-help URL');
  stop();

  console.log('\n== 16. hosted daily 30-min quota ==');
  storageData.claudeModel = 'hosted';
  delete storageData.hostedUsage;
  // fresh day: quota available
  let q;
  await new Promise(res => onMessageListener({ type: 'GET_HOSTED_QUOTA' }, {}, (r) => { q = r; res(); }));
  assert(q && q.limitSec === 1800 && q.remainingSec === 1800 && q.exhausted === false, 'fresh quota = 30 min available');

  const r16 = await start();
  assert(r16.ok === true, 'hosted starts when quota available');
  // while a hosted session runs, halting for quota notifies the tab + resets state
  sentToTab.length = 0;
  haltForQuota();  // reachable function; reads the SW's own activeTabId (=42) from the live session
  assert(sentToTab.some(m => m.type === 'QUOTA_EXHAUSTED' && m.keyHelpUrl.includes('aistudio') && m.limitMin === 30), 'haltForQuota sends explanation to overlay');
  let st;
  onMessageListener({ type: 'GET_STATUS' }, {}, (r) => { st = r; });
  assert(st && st.isCapturing === false, 'haltForQuota resets capturing state');

  // now exhaust the daily quota
  storageData.hostedUsage = { date: todayStr(), seconds: 1800 };
  await new Promise(res => onMessageListener({ type: 'GET_HOSTED_QUOTA' }, {}, (r) => { q = r; res(); }));
  assert(q && q.exhausted === true && q.remainingSec === 0, 'quota reports exhausted at 30 min');

  const r16b = await start();
  assert(r16b.ok === false && r16b.error === 'QUOTA_EXHAUSTED', 'hosted start REFUSED when quota exhausted');

  // BYO users are NOT limited
  storageData.claudeModel = 'gemini:gemini-3.5-flash';
  storageData.geminiKey = 'AIza-test';
  storageData.hostedUsage = { date: todayStr(), seconds: 999999 }; // huge, but irrelevant for BYO
  const r16c = await start();
  assert(r16c.ok === true, 'BYO user NOT blocked by hosted quota');
  stop();

  console.log(failures ? `\n${failures} FAILURES` : '\nALL TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
