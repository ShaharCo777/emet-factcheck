// popup.js - אמת (Emet)

const toggleBtn    = document.getElementById('toggleBtn');
const statusEl     = document.getElementById('status');
const anthropicEl  = document.getElementById('anthropicKey');
const geminiEl     = document.getElementById('geminiKey');
const groqEl       = document.getElementById('groqKey');
const deepgramEl   = document.getElementById('deepgramKey');
const brightdataEl = document.getElementById('brightdataKey');
const bdZoneEl     = document.getElementById('brightdataZone');
const modelEl      = document.getElementById('modelSelect');
const keyHint      = document.getElementById('keyHint');
const keysSection  = document.getElementById('keysSection');

const anthropicField = document.getElementById('anthropicField');
const geminiField    = document.getElementById('geminiField');
const groqField      = document.getElementById('groqField');
const byoFields      = document.getElementById('byoFields');
const deepgramField  = document.getElementById('deepgramField');
const bdKeyField     = document.getElementById('bdKeyField');
const bdZoneField    = document.getElementById('bdZoneField');
const searchNote     = document.getElementById('searchNote');
const hostedBanner   = document.getElementById('hostedBanner');
const advancedSection = document.getElementById('advancedSection');
const attributionEl  = document.getElementById('attribution');

let isActive = false;

function currentProvider() {
  const v = modelEl.value;
  if (v === 'hosted')          return 'hosted';
  if (v.startsWith('gemini:')) return 'gemini';
  if (v.startsWith('groq:'))   return 'groq';
  return 'anthropic';
}

function providerKeyEl() {
  const p = currentProvider();
  return p === 'gemini' ? geminiEl : p === 'groq' ? groqEl : anthropicEl;
}

let hostedKeyHelpUrl = 'https://aistudio.google.com/apikey';

// מעדכן את הבאנר במצב מארח: כמה דקות נותרו היום, או הסבר אם נגמרו
function updateHostedBanner() {
  if (currentProvider() !== 'hosted') return;
  chrome.runtime.sendMessage({ type: 'GET_HOSTED_QUOTA' }, (q) => {
    if (!q || currentProvider() !== 'hosted') return;
    if (q.exhausted) {
      hostedBanner.innerHTML = '🎉 סיימת את ' + Math.round(q.limitSec / 60) + ' הדקות שלך להיום.<br>' +
        'להמשך ללא הגבלה: פתחו «הגדרות מתקדמות», בחרו Gemini והדביקו ' +
        '<a href="' + hostedKeyHelpUrl + '" target="_blank" rel="noopener">מפתח</a>. או חזרו מחר.';
      hostedBanner.className = 'hosted-banner exhausted';
      advancedSection.open = true;
      toggleBtn.disabled = true;
    } else {
      const min = Math.max(1, Math.ceil(q.remainingSec / 60));
      hostedBanner.innerHTML = '✓ מוכן לשימוש - לא צריך להזין כלום. נותרו ' + min + ' דקות להיום.';
      hostedBanner.className = 'hosted-banner';
      toggleBtn.disabled = false;
    }
  });
}

function refreshProviderFields() {
  const p = currentProvider();
  const hosted = p === 'hosted';
  // מצב מארח: באנר "מוכן" בלבד. כל שדות המפתחות (byoFields) מוסתרים לגמרי.
  hostedBanner.style.display = hosted ? '' : 'none';
  byoFields.style.display    = hosted ? 'none' : '';
  if (hosted) { updateHostedBanner(); return; }

  // מצב "מפתח משלכם": מציגים את השדות הרלוונטיים, מקובצים לפי תפקיד
  anthropicField.style.display = p === 'anthropic' ? '' : 'none';
  // מפתח Gemini משמש למודל וגם לתמלול - מציגים כשהמודל Gemini או כשאין Deepgram
  geminiField.style.display    = (p === 'gemini' || !deepgramEl.value.trim()) ? '' : 'none';
  groqField.style.display      = p === 'groq' ? '' : 'none';
  // חיפוש: מובנה ב-Claude/Gemini, דרך Bright Data ב-Groq
  searchNote.style.display  = (p === 'gemini' || p === 'anthropic') ? '' : 'none';
  bdKeyField.style.display  = p === 'groq' ? '' : 'none';
  bdZoneField.style.display = p === 'groq' ? '' : 'none';
}

// ── טעינת ערכים שמורים ────────────────────────────────────────────────────────

chrome.storage.local.get(
  ['anthropicKey', 'geminiKey', 'groqKey', 'deepgramKey', 'brightdataKey', 'brightdataZone', 'claudeModel'],
  (data) => {
    if (data.anthropicKey)  { anthropicEl.value  = data.anthropicKey;  anthropicEl.classList.add('saved'); }
    if (data.geminiKey)     { geminiEl.value     = data.geminiKey;     geminiEl.classList.add('saved'); }
    if (data.groqKey)       { groqEl.value       = data.groqKey;       groqEl.classList.add('saved'); }
    if (data.deepgramKey)   { deepgramEl.value   = data.deepgramKey;   deepgramEl.classList.add('saved'); }
    if (data.brightdataKey) { brightdataEl.value = data.brightdataKey; brightdataEl.classList.add('saved'); }
    bdZoneEl.value = data.brightdataZone || 'serp_api';
    // ברירת מחדל: 'hosted'. מיגרציה: gemini-2.5 הוצא משימוש.
    const chosen = (data.claudeModel || 'hosted').replace('gemini-2.5-', 'gemini-3.5-');
    if (chosen !== data.claudeModel) chrome.storage.local.set({ claudeModel: chosen });
    modelEl.value = chosen;
    // ההגדרות המתקדמות (והמפתחות) נשארות סגורות כברירת מחדל.
    // נפתחות רק אם חסר מפתח נדרש - כדי שהמשתמש יוכל לתקן.
    advancedSection.open = needsKeyConfig();
    refreshProviderFields();
    updateHint();
  });

// האם חסר מפתח נדרש למצב הנוכחי (לא רלוונטי במצב מארח)
function needsKeyConfig() {
  if (currentProvider() === 'hosted') return false;
  if (!providerKeyEl().value.trim()) return true;
  if (!sttConfigured()) return true;
  return false;
}

// ── קרדיט (קישור אישי של המפתח) ───────────────────────────────────────────────
chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (cfg) => {
  if (!cfg) return;
  if (cfg.keyHelpUrl) hostedKeyHelpUrl = cfg.keyHelpUrl;
  if (cfg.attributionUrl && !cfg.attributionUrl.includes('CHANGE-ME')) {
    attributionEl.href = cfg.attributionUrl;
    attributionEl.textContent = cfg.attributionText || 'נבנה באהבה';
    attributionEl.style.display = '';
  }
});

// ── שמירה בעת שינוי ───────────────────────────────────────────────────────────

function bindKeyField(el, storageKey) {
  el.addEventListener('input', () => {
    el.classList.remove('saved');
    refreshProviderFields();
    updateHint();
  });
  el.addEventListener('change', () => {
    chrome.storage.local.set({ [storageKey]: el.value.trim() });
    el.classList.add('saved');
    refreshProviderFields();
    updateHint();
  });
}

bindKeyField(anthropicEl,  'anthropicKey');
bindKeyField(geminiEl,     'geminiKey');
bindKeyField(groqEl,       'groqKey');
bindKeyField(deepgramEl,   'deepgramKey');
bindKeyField(brightdataEl, 'brightdataKey');
bindKeyField(bdZoneEl,     'brightdataZone');

modelEl.addEventListener('change', () => {
  chrome.storage.local.set({ claudeModel: modelEl.value });
  refreshProviderFields();
  updateHint();
});

const PROVIDER_LABEL = { anthropic: 'Anthropic', gemini: 'Google AI', groq: 'Groq' };

function sttConfigured() {
  return !!(deepgramEl.value.trim() || geminiEl.value.trim());
}

function updateHint() {
  // מצב מארח: לא צריך שום מפתח - תמיד מוכן
  if (currentProvider() === 'hosted') {
    toggleBtn.disabled = false;
    keyHint.textContent = '';
    keyHint.className = 'key-hint';
    return;
  }

  const missing = [];
  if (!providerKeyEl().value.trim()) missing.push(PROVIDER_LABEL[currentProvider()]);
  if (!sttConfigured()) missing.push('תמלול (Google AI או Deepgram)');

  if (missing.length) {
    keyHint.textContent = 'חסרים מפתחות: ' + missing.join(', ');
    keyHint.className = 'key-hint';
    toggleBtn.disabled = isActive ? false : true;
    return;
  }

  toggleBtn.disabled = false;
  const notes = [];
  const p = currentProvider();
  if (p === 'gemini') {
    notes.push(deepgramEl.value.trim()
      ? 'מפתח Gemini לבדיקה + Deepgram לתמלול חי.'
      : '✓ מפתח אחד מספיק - Gemini מתמלל, בודק ומחפש ראיות.');
  } else if (p === 'groq') {
    if (!brightdataEl.value.trim()) notes.push('ללא Bright Data הפסיקות יתבססו על ידע המודל בלבד.');
  } else {
    notes.push('חיפוש הראיות מובנה במודל.');
  }
  if (!deepgramEl.value.trim()) notes.push('התמלול נעשה עם Gemini במקטעים של ~15 שניות.');
  keyHint.textContent = notes.join(' ');
  keyHint.className = 'key-hint ok';
}

// ── בדיקת חיבור Deepgram ──────────────────────────────────────────────────────
// מדמה את החיבור האמיתי של התוסף ומאבחן: מפתח שגוי / חוסר קרדיט / פרמטר לא נתמך

function setHint(text, cls) {
  keyHint.textContent = text;
  keyHint.className = 'key-hint' + (cls ? ' ' + cls : '');
}

document.getElementById('dgTestBtn').addEventListener('click', async () => {
  const key = deepgramEl.value.trim();
  if (!key) { setHint('הזינו מפתח Deepgram קודם.', 'error'); return; }
  setHint('בודק חיבור ל-Deepgram...');

  const tryWs = (params) => new Promise(resolve => {
    let settled = false;
    let ws;
    try { ws = new WebSocket('wss://api.deepgram.com/v1/listen?' + params, ['token', key]); }
    catch (e) { resolve({ ok: false, err: e.message }); return; }
    const done = (result) => { if (!settled) { settled = true; clearTimeout(to); try { ws.close(); } catch {} resolve(result); } };
    const to = setTimeout(() => done({ ok: false, err: 'timeout' }), 7000);
    ws.onopen  = () => done({ ok: true });
    ws.onclose = (e) => done({ ok: false, err: 'קוד ' + e.code + (e.reason ? ' - ' + e.reason : '') });
  });

  // בדיקה עם הפרמטרים המלאים של התוסף
  const full = await tryWs('encoding=linear16&sample_rate=48000&channels=1&model=nova-3&language=he&punctuate=true&interim_results=true&smart_format=true&utterance_end_ms=2500&vad_events=true&diarize=true');
  if (full.ok) {
    setHint('✓ החיבור תקין! מפתח, מודל nova-3 ועברית עובדים. אפשר להתחיל בדיקת עובדות.', 'ok');
    return;
  }

  // הפרמטרים המלאים נכשלו - בדיקה מינימלית מבודדת את הבעיה
  const minimal = await tryWs('model=nova-3&language=he');
  if (minimal.ok) {
    setHint('המפתח תקין, אך אחד הפרמטרים נדחה (' + full.err + '). התוסף ייפול אוטומטית למצב מצומצם - אפשר להתחיל.', 'ok');
    return;
  }

  // גם המינימלי נכשל - בודקים את המפתח עצמו מול ה-REST API
  try {
    const res = await fetch('https://api.deepgram.com/v1/projects', { headers: { 'Authorization': 'Token ' + key } });
    if (res.status === 401) {
      setHint('✗ המפתח לא תקין (401). צרו מפתח חדש ב-console.deepgram.com והדביקו אותו כאן.', 'error');
    } else if (res.ok) {
      setHint('✗ המפתח תקין אבל הסטרימינג נדחה (' + minimal.err + '). ככל הנראה נגמר הקרדיט בחשבון, או שאין גישה ל-nova-3 בעברית. בדקו ב-console.deepgram.com.', 'error');
    } else {
      setHint('✗ שגיאה בבדיקת המפתח: HTTP ' + res.status, 'error');
    }
  } catch (e) {
    setHint('✗ שגיאת רשת בבדיקה: ' + e.message, 'error');
  }
});

// ── גיבוי ושחזור מפתחות ───────────────────────────────────────────────────────

const SETTINGS_KEYS = ['anthropicKey', 'geminiKey', 'groqKey', 'deepgramKey', 'brightdataKey', 'brightdataZone', 'claudeModel'];

document.getElementById('exportBtn').addEventListener('click', () => {
  chrome.storage.local.get(SETTINGS_KEYS, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emet-keys-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    keyHint.textContent = 'הגיבוי הורד. שמרו את הקובץ במקום בטוח - הוא מכיל את המפתחות שלכם.';
    keyHint.className = 'key-hint ok';
  });
});

const importFileEl = document.getElementById('importFile');
document.getElementById('importBtn').addEventListener('click', () => importFileEl.click());
importFileEl.addEventListener('change', () => {
  const file = importFileEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const toSet = {};
      for (const k of SETTINGS_KEYS) if (typeof data[k] === 'string') toSet[k] = data[k];
      if (!Object.keys(toSet).length) throw new Error('empty');
      chrome.storage.local.set(toSet, () => location.reload());
    } catch {
      keyHint.textContent = 'קובץ הגיבוי לא תקין.';
      keyHint.className = 'key-hint error';
    }
  };
  reader.readAsText(file);
  importFileEl.value = '';
});

// ── סטטוס ─────────────────────────────────────────────────────────────────────

chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
  if (res?.isCapturing) setActive(true);
});

function setActive(active) {
  isActive = active;
  toggleBtn.textContent  = active ? 'עצור בדיקת עובדות' : 'התחל בדיקת עובדות';
  toggleBtn.className    = 'toggle-btn' + (active ? ' active' : '');
  // מציגים סטטוס רק כשפעיל - אין טעם בשורת "לא פעיל" כשיש כפתור "התחל"
  statusEl.style.display = active ? '' : 'none';
  statusEl.textContent   = active ? '● פעיל - בדיקת עובדות רצה' : '';
  statusEl.className     = 'status' + (active ? ' active' : '');
  advancedSection.style.display = active ? 'none' : '';
  hostedBanner.style.display = (!active && currentProvider() === 'hosted') ? '' : 'none';
  if (!active) { refreshProviderFields(); updateHint(); }
}

// ── הפעלה / כיבוי ─────────────────────────────────────────────────────────────

toggleBtn.addEventListener('click', async () => {
  if (isActive) {
    chrome.runtime.sendMessage({ type: 'STOP_FACTCHECK' });
    setActive(false);
    return;
  }

  // מצב מארח: אין צורך בשום מפתח
  if (currentProvider() !== 'hosted') {
    const llmKey = providerKeyEl().value.trim();
    if (!llmKey || !sttConfigured()) {
      keyHint.textContent = 'יש להזין מפתח ' + PROVIDER_LABEL[currentProvider()] + ' ומפתח לתמלול (Google AI או Deepgram).';
      keyHint.className   = 'key-hint error';
      return;
    }
  }
  const deepgramKey = deepgramEl.value.trim();

  await new Promise(r => chrome.storage.local.set({
    anthropicKey: anthropicEl.value.trim(),
    geminiKey: geminiEl.value.trim(),
    groqKey: groqEl.value.trim(),
    deepgramKey,
    brightdataKey: brightdataEl.value.trim(),
    brightdataZone: bdZoneEl.value.trim() || 'serp_api',
    claudeModel: modelEl.value,
  }, r));

  chrome.runtime.sendMessage({ type: 'START_FACTCHECK' }, (res) => {
    if (res?.ok) {
      setActive(true);
    } else if (res?.error === 'QUOTA_EXHAUSTED') {
      // המכסה היומית נגמרה - מציגים את ההסבר בבאנר במקום שגיאה גולמית
      updateHostedBanner();
    } else {
      keyHint.textContent = 'ההפעלה נכשלה: ' + (res?.error || 'שגיאה לא ידועה');
      keyHint.className   = 'key-hint error';
    }
  });
});
