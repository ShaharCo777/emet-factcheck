// overlay.js - אמת (Emet)
// פאנל צף בעברית (RTL): תמלול חי, טענות, וכרטיסי פסיקה.

console.log('[overlay] content script loaded');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// תרגום פסיקות לעברית לתצוגה - הערכים הפנימיים נשארים באנגלית
const VERDICT_HE = {
  'TRUE':               'נכון',
  'SUBSTANTIALLY TRUE': 'נכון בעיקרו',
  'FALSE':              'לא נכון',
  'MISLEADING':         'מטעה',
  'UNVERIFIABLE':       'לא ניתן לאימות',
};
const CONFIDENCE_HE = { HIGH: 'גבוהה', MEDIUM: 'בינונית', LOW: 'נמוכה' };

function verdictLabel(v)    { return VERDICT_HE[v] || v; }
function confidenceLabel(c) { return CONFIDENCE_HE[c] || c || ''; }

// לוח תוצאות חי - כמה פסיקות מכל סוג הצטברו בסשן
function updateSummaryBar() {
  const el = panel?.querySelector('#emet-summary');
  if (!el || typeof sessionLog === 'undefined') return;
  const count = v => sessionLog.filter(e => e.verdict === v).length;
  const chips = [
    ['TRUE', 'green'], ['SUBSTANTIALLY TRUE', 'teal'],
    ['FALSE', 'red'], ['MISLEADING', 'yellow'],
  ].map(([v, color]) => {
    const n = count(v);
    return n ? '<span class="emet-sum emet-sum--' + color + '">' + VERDICT_HE[v] + ' · ' + n + '</span>' : '';
  }).filter(Boolean);
  el.innerHTML = chips.join('');
  el.style.display = chips.length ? '' : 'none';
}

// נקודת הסטטוס בכותרת - צבע לפי מצב התמלול
function setStatusDot(state) {
  const dot = panel?.querySelector('.emet-dot');
  if (!dot) return;
  dot.className = 'emet-dot' + (state ? ' emet-dot--' + state : '');
}

let panel = null;
let transcriptFeedEl = null;
let interimEl = null;
let claimFeedEl = null;
let verdictListEl = null;
let transcriptCollapsed = false;
const pendingCards     = new Map();
const pendingCardTimes = new Map();

// פקיעת כרטיסים ממתינים אחרי 4 דקות - האימות במודלים חינמיים רץ טורית,
// ו-5 טענות בחלון אחד יכולות לקחת יותר מ-90 שניות
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of pendingCardTimes) {
    if (now - time > 240000) {
      const card = pendingCards.get(key);
      if (card) {
        card.classList.remove('emet-verdict--pending');
        const verifying = card.querySelector('.emet-verifying');
        if (verifying) verifying.textContent = '⚠ לא אומת';
      }
      pendingCards.delete(key);
      pendingCardTimes.delete(key);
    }
  }
}, 15000);

let lastTranscriptTimestamp = '';
const sentenceTimestamps   = [];
const MAX_TIMESTAMP_BUFFER = 10;
let windowsScanned = 0;

// ── דוברים ────────────────────────────────────────────────────────────────────
let speakers = [];

const SPEAKER_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#f97316',
];
const speakerColorMap = new Map();

function getSpeakerColor(name) {
  if (!speakerColorMap.has(name)) {
    const idx = speakerColorMap.size % SPEAKER_COLORS.length;
    speakerColorMap.set(name, SPEAKER_COLORS[idx]);
  }
  return speakerColorMap.get(name);
}

// ── זיהוי דוברים מכותרת (מקבילה לגרסת ה-service worker) ──────────────────────
const SPEAKER_PARSE_NOISE = new Set([
  'עימות', 'ראיון', 'שידור', 'חי', 'מלא', 'המלא', 'הרשמי', 'הערב', 'לצפייה',
  'ישירה', 'מיוחד', 'בלעדי', 'תוכנית', 'פרק', 'חדשות',
  '2020', '2021', '2022', '2023', '2024', '2025', '2026',
  'debate', 'live', 'full', 'official', 'interview',
]);

function parseSpeakersFromTitle(title) {
  if (!title) return [];
  const clean = title.split('|')[0].split('–')[0].trim();

  const vsSplit = clean.split(/\s+(?:מול|נגד|לעומת|vs\.?|versus)\s+/i);
  if (vsSplit.length >= 2) {
    const lastName = part => {
      const words = part.trim().split(/\s+/);
      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i].replace(/["'׳״.,:!?]/g, '');
        if (w.length >= 2 && !SPEAKER_PARSE_NOISE.has(w) && !/^\d+$/.test(w)) return w;
      }
      return null;
    };
    const a = lastName(vsSplit[0]);
    const b = lastName(vsSplit[1]);
    if (a && b) return [a, b];
  }

  const interviewMatch = clean.match(/ראיון(?:\s+מיוחד)?\s+עם\s+(\S+(?:\s+\S+)?)/);
  if (interviewMatch) {
    const name = interviewMatch[1].replace(/["'׳״.,:!?]/g, '').trim();
    if (name) return [name];
  }

  return [];
}

let lastActiveSpeaker = null;

function normalizeSpeakerName(name) {
  if (!name) return name;
  for (const speaker of speakers) {
    const lastName = speaker.trim().split(' ').pop();
    if (name === speaker) return speaker;
    if (name.includes(lastName)) return speaker;
  }
  return name;
}

// ── אישור זהות דוברים ─────────────────────────────────────────────────────────

const confirmedSpeakerMap = {};
const pendingSpeakerIds   = new Set();

function showSpeakerBanner(speakerId, sample) {
  const sid = String(speakerId);
  if (pendingSpeakerIds.has(sid)) return;
  if (sid in confirmedSpeakerMap) return;
  if (!speakers.length) {
    setTimeout(() => showSpeakerBanner(speakerId, sample), 1000);
    return;
  }
  pendingSpeakerIds.add(sid);

  const banner = document.createElement('div');
  banner.className = 'emet-speaker-banner';
  banner.innerHTML =
    '<div class="emet-speaker-banner-text">זוהה דובר חדש - מי זה?</div>' +
    '<div class="emet-speaker-banner-sample">"' + escapeHtml(sample) + '..."</div>' +
    '<div class="emet-speaker-banner-buttons">' +
      speakers.map(name =>
        '<button class="emet-speaker-banner-btn" data-name="' + escapeHtml(name) + '" data-id="' + sid + '">' + escapeHtml(name) + '</button>'
      ).join('') +
      '<button class="emet-speaker-banner-btn emet-speaker-banner-btn--skip" data-id="' + sid + '">דלג</button>' +
    '</div>';

  banner.querySelectorAll('.emet-speaker-banner-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.name;
      const id   = btn.dataset.id;
      if (name) {
        confirmedSpeakerMap[id] = name;
        chrome.runtime.sendMessage({
          type: 'SPEAKER_NAMES',
          speakerIdToName: { [id]: name },
        });
      }
      pendingSpeakerIds.delete(id);
      if (!name) confirmedSpeakerMap[id] = null;
      banner.remove();
      retryTagAllCards();
    });
  });

  const verdictsSection = panel?.querySelector('#emet-verdicts-section');
  if (verdictsSection) verdictsSection.insertAdjacentElement('beforebegin', banner);
}

function allSpeakersConfirmed() {
  if (!speakers.length) return false;
  return speakers.every((_, i) => String(i) in confirmedSpeakerMap);
}

function retryTagAllCards() {
  if (!verdictListEl) return;
  verdictListEl.querySelectorAll('.emet-verdict:not(.emet-verdict--pending)').forEach(card => {
    const sid = card.dataset.speakerid;
    if (sid === undefined) return;
    const rawName = confirmedSpeakerMap[sid];
    if (!rawName) return;
    const name = normalizeSpeakerName(rawName);
    let tag = card.querySelector('.emet-speaker-tag');
    if (tag) {
      tag.textContent = name;
      tag.style.background = getSpeakerColor(name);
    } else {
      const color = getSpeakerColor(name);
      tag = document.createElement('div');
      tag.className = 'emet-speaker-tag';
      tag.style.background = color;
      tag.textContent = name;
      card.insertBefore(tag, card.firstChild);
    }
  });
}

// ── עריכת שמות דוברים ─────────────────────────────────────────────────────────

function sendSpeakerMap() {
  const speakerIdToName = {};
  speakers.forEach((name, i) => { speakerIdToName[i] = name; });
  chrome.runtime.sendMessage({ type: 'SPEAKER_NAMES', speakerIdToName });
}

function renderSpeakerEditor() {
  const el = panel?.querySelector('#emet-speaker-editor');
  if (!el || !speakers.length) return;

  el.innerHTML = speakers.map((name, i) => {
    const color = getSpeakerColor(name);
    return '<span class="emet-speaker-chip" style="border-color:' + color + ';color:' + color + '" data-idx="' + i + '">' +
      '<input class="emet-speaker-chip-input" value="' + escapeHtml(name) + '" data-idx="' + i + '" style="color:' + color + '" />' +
    '</span>';
  }).join('');

  el.querySelectorAll('.emet-speaker-chip-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const oldName = speakers[idx];
      const newName = e.target.value.trim() || oldName;
      if (newName === oldName) return;

      if (speakerColorMap.has(oldName)) {
        speakerColorMap.set(newName, speakerColorMap.get(oldName));
        speakerColorMap.delete(oldName);
      }

      speakers[idx] = newName;
      e.target.style.color = getSpeakerColor(newName);
      e.target.closest('.emet-speaker-chip').style.borderColor = getSpeakerColor(newName);
      e.target.closest('.emet-speaker-chip').style.color = getSpeakerColor(newName);
      sendSpeakerMap();

      const cards = verdictListEl?.querySelectorAll('.emet-speaker-tag');
      if (cards) {
        cards.forEach(tag => {
          if (tag.textContent === oldName) {
            tag.textContent = newName;
            tag.style.background = getSpeakerColor(newName);
          }
        });
      }
    });
    input.addEventListener('focus', e => e.target.select());
  });
}

// ── הודעת שגיאה ───────────────────────────────────────────────────────────────

function showError(message) {
  if (!panel) return;
  const existing = panel.querySelector('.emet-error-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'emet-error-toast';
  toast.innerHTML =
    '<span class="emet-error-icon">⚠</span>' +
    '<span class="emet-error-msg">' + escapeHtml(message) + '</span>' +
    '<button class="emet-error-close">✕</button>';

  toast.querySelector('.emet-error-close').addEventListener('click', () => toast.remove());
  panel.querySelector('#emet-header').insertAdjacentElement('afterend', toast);

  if (!message.includes('נכשל') && !message.includes('מפתח')) {
    setTimeout(() => toast.remove(), 8000);
  }
}

// ── הסבר מיצוי מכסה יומית ──────────────────────────────────────────────────────
function showQuotaExplanation(keyHelpUrl, limitMin) {
  if (!panel) return;
  const body = panel.querySelector('#emet-body');
  if (!body) return;
  // מסתירים את התמלול החי ומציגים כרטיס הסבר גדול
  const existing = panel.querySelector('.emet-quota-card');
  if (existing) return;
  const card = document.createElement('div');
  card.className = 'emet-quota-card';
  card.innerHTML =
    '<div class="emet-quota-title">🎉 סיימת את ' + limitMin + ' הדקות החינמיות של היום</div>' +
    '<div class="emet-quota-text">כדי להמשיך עכשיו <b>בלי הגבלה</b>, הוסיפו מפתח Google AI חינמי משלכם (2 דקות, בלי כרטיס אשראי):</div>' +
    '<ol class="emet-quota-steps">' +
      '<li>לחצו על אייקון התוסף בסרגל הכלים</li>' +
      '<li>פתחו את «⚙ הגדרות מתקדמות»</li>' +
      '<li>בחרו מודל Gemini והדביקו מפתח מ<a href="' + escapeHtml(keyHelpUrl) + '" target="_blank" rel="noopener">כאן</a></li>' +
    '</ol>' +
    '<div class="emet-quota-text">או פשוט חזרו מחר ל-' + limitMin + ' דקות נוספות בחינם.</div>';
  body.insertBefore(card, body.firstChild);
  setStatusDot('warn');
  updateInterim('');
}

// ── הפאנל ─────────────────────────────────────────────────────────────────────
function createPanel() {
  if (panel) return;

  panel = document.createElement('div');
  panel.id = 'emet-panel';
  panel.dir = 'rtl';
  panel.innerHTML = [
    '<div id="emet-header">',
      '<span><span class="emet-dot"></span>Emet</span>',
      '<div class="emet-header-actions">',
        '<button id="emet-export" title="ייצוא דוח">↓ ייצוא</button>',
        '<button id="emet-close">✕</button>',
      '</div>',
    '</div>',
    '<div id="emet-tagline">בדיקה אוטומטית עם AI · המקורות למטה</div>',
    '<div id="emet-body">',
      '<div id="emet-transcript-section">',
        '<div class="emet-section-header">',
          '<span class="emet-section-label">תמלול</span>',
          '<button class="emet-toggle-btn" id="emet-transcript-toggle">▾</button>',
        '</div>',
        '<div id="emet-transcript-feed"></div>',
        '<p id="emet-interim"></p>',
      '</div>',
      '<div id="emet-claims-section">',
        '<div class="emet-section-header">',
          '<span class="emet-section-label">טענות</span>',
        '</div>',
        '<p id="emet-claims-status" class="emet-empty">טענות יופיעו כאן...</p>',
        '<ul id="emet-claim-feed"></ul>',
      '</div>',
      '<div id="emet-verdicts-section">',
        '<div class="emet-section-header">',
          '<span class="emet-section-label">פסיקות</span>',
          '<button class="emet-toggle-btn" id="emet-min-all" title="מזעור/הרחבת כל הפסיקות">⇕</button>',
          '<div id="emet-speaker-editor"></div>',
        '</div>',
        '<div id="emet-summary"></div>',
        '<div id="emet-verdicts">',
          '<p class="emet-empty">פסיקות יופיעו כאן...</p>',
        '</div>',
      '</div>',
      '<a id="emet-attribution" target="_blank" rel="noopener" style="display:none"></a>',
    '</div>',
  ].join('');

  document.body.appendChild(panel);

  transcriptFeedEl = panel.querySelector('#emet-transcript-feed');
  interimEl        = panel.querySelector('#emet-interim');
  claimFeedEl      = panel.querySelector('#emet-claim-feed');
  verdictListEl    = panel.querySelector('#emet-verdicts');

  // סגירה: קודם מסירים את הפאנל (מה שהמשתמש רוצה), ואז מודיעים לרקע -
  // כך גם אם החיבור לרקע מת (אחרי טעינה מחדש), ה-X תמיד סוגר.
  panel.querySelector('#emet-close').addEventListener('click', () => {
    removePanel();
    try { chrome.runtime.sendMessage({ type: 'STOP_FACTCHECK' }); } catch (e) {}
  });

  panel.querySelector('#emet-export').addEventListener('click', () => exportReport());

  makeDraggable(panel);

  panel.querySelector('#emet-transcript-toggle').addEventListener('click', () => {
    transcriptCollapsed = !transcriptCollapsed;
    transcriptFeedEl.style.display = transcriptCollapsed ? 'none' : '';
    interimEl.style.display = transcriptCollapsed ? 'none' : '';
    panel.querySelector('#emet-transcript-toggle').textContent = transcriptCollapsed ? '◂' : '▾';
  });

  // מזעור/הרחבה של כל הפסיקות בבת אחת
  let allMinimized = false;
  panel.querySelector('#emet-min-all').addEventListener('click', () => {
    allMinimized = !allMinimized;
    verdictListEl?.querySelectorAll('.emet-verdict').forEach(card => {
      card.classList.toggle('emet-verdict--min', allMinimized);
      const b = card.querySelector('.emet-min-btn');
      if (b) { b.textContent = allMinimized ? '◂' : '▾'; b.title = allMinimized ? 'הרחב' : 'מזער'; }
    });
  });

  // קרדיט המפתח - אחרון ובעטיפת try/catch כדי שלעולם לא ישבור את בניית הפאנל
  try {
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (cfg) => {
      const el = panel?.querySelector('#emet-attribution');
      if (el && cfg?.attributionUrl && !cfg.attributionUrl.includes('CHANGE-ME')) {
        el.href = cfg.attributionUrl;
        el.textContent = cfg.attributionText || 'נבנה באהבה';
        el.style.display = '';
      }
    });
  } catch (e) { /* הרקע לא זמין - לא נורא */ }
}

function removePanel() {
  panel?.remove();
  panel = null;
  transcriptFeedEl = null;
  interimEl = null;
  claimFeedEl = null;
  verdictListEl = null;
  transcriptCollapsed = false;
  pendingCards.clear();
  pendingCardTimes.clear();
  speakers = [];
  speakerColorMap.clear();
  sentenceTimestamps.length = 0;
  lastTranscriptTimestamp = '';
  lastActiveSpeaker = null;
  windowsScanned = 0;
  Object.keys(confirmedSpeakerMap).forEach(k => delete confirmedSpeakerMap[k]);
  pendingSpeakerIds.clear();
}

// ── תמלול ─────────────────────────────────────────────────────────────────────
function addTranscriptText(text) {
  if (!transcriptFeedEl) return;
  const span = document.createElement('span');
  span.textContent = text + ' ';
  span.className = 'emet-transcript-word';
  transcriptFeedEl.appendChild(span);
  transcriptFeedEl.scrollTop = transcriptFeedEl.scrollHeight;
}

function updateInterim(text) {
  if (!interimEl) return;
  interimEl.textContent = text;
}

function clearInterim() {
  if (!interimEl) return;
  interimEl.textContent = '';
}

// ── טענות ─────────────────────────────────────────────────────────────────────
function claimWordsSet(claim) {
  return new Set(claim.split(/\s+/).map(w => w.replace(/["'׳״.,:!?]/g, '')).filter(w => w.length >= 3));
}

function addClaimBullet(claim) {
  if (!claimFeedEl) return;
  panel?.querySelector('#emet-claims-status')?.remove();
  const li = document.createElement('li');
  li.className = 'emet-claim-bullet emet-claim-bullet--pending';
  li.dataset.claim = claim.slice(0, 40);
  li.textContent = claim;
  claimFeedEl.appendChild(li);
  return li;
}

function applyVerdictToBullet(claim, verdict, confidence) {
  if (!claimFeedEl) return;
  const color = colorForVerdict(verdict, confidence);
  const claimWords = claimWordsSet(claim);
  const bullets = claimFeedEl.querySelectorAll('.emet-claim-bullet');
  let bestLi = null, bestScore = 0;
  for (const li of bullets) {
    const bulletWords = [...claimWordsSet(li.textContent || '')];
    const overlap = bulletWords.filter(w => claimWords.has(w)).length;
    const score = overlap / Math.max(claimWords.size, bulletWords.length);
    if (score > bestScore) { bestScore = score; bestLi = li; }
  }
  if (bestLi && bestScore >= 0.3) {
    bestLi.className = 'emet-claim-bullet emet-claim-bullet--' + color;
  }
}

// ── פסיקות ────────────────────────────────────────────────────────────────────
function colorForVerdict(verdict, confidence) {
  if (confidence === 'LOW')              return 'yellow';
  if (verdict === 'TRUE')                return 'green';
  if (verdict === 'SUBSTANTIALLY TRUE')  return 'teal';
  if (verdict === 'FALSE')               return 'red';
  if (verdict === 'MISLEADING')          return 'yellow';
  if (verdict === 'UNVERIFIABLE')        return 'grey';
  return 'grey';
}

function buildLexicalRows(lexical) {
  if (!lexical) return '';
  const rows = [];
  const r = lexical.rates || {};
  if (r.hedging > 0)
    rows.push('<div class="emet-conviction-row"><span class="emet-conviction-label">שפת הסתייגות:</span> ' + r.hedging + '% - למשל "אולי", "כנראה", "לדעתי"</div>');
  if (r.certainty > 0)
    rows.push('<div class="emet-conviction-row"><span class="emet-conviction-label">סמני ודאות:</span> ' + r.certainty + '% - למשל "בוודאות", "תמיד"</div>');
  if (r.filler > 0)
    rows.push('<div class="emet-conviction-row"><span class="emet-conviction-label">מילות מילוי:</span> ' + r.filler + '% - למשל "אה", "כאילו", "בעצם"</div>');
  if (r.emotional > 0)
    rows.push('<div class="emet-conviction-row"><span class="emet-conviction-label">שפה רגשית:</span> ' + r.emotional + '%</div>');
  if (r.exclusive > 0)
    rows.push('<div class="emet-conviction-row"><span class="emet-conviction-label">מילות הסתייגות:</span> ' + r.exclusive + '% - למשל "אבל", "למרות"</div>');
  if (r.firstPersonSg > 0)
    rows.push('<div class="emet-conviction-row"><span class="emet-conviction-label">גוף ראשון יחיד:</span> ' + r.firstPersonSg + '%</div>');
  if (lexical.wordsPerSecond != null) {
    const rateDesc = lexical.wordsPerSecond > 3.5 ? 'מהיר' : lexical.wordsPerSecond < 2 ? 'איטי' : 'בינוני';
    rows.push('<div class="emet-conviction-row"><span class="emet-conviction-label">קצב דיבור:</span> ' + lexical.wordsPerSecond + ' מילים/שנייה (' + rateDesc + ')</div>');
  }
  return rows.join('');
}

function buildCard(result) {
  const color = colorForVerdict(result.verdict, result.confidence);
  const convictionColor = result.speaker_confidence === 'HIGH' ? 'green'
                        : result.speaker_confidence === 'LOW'  ? 'red'
                        : 'yellow';

  const card = document.createElement('div');
  card.className = 'emet-verdict emet-verdict--' + color + (result.pending ? ' emet-verdict--pending' : '');
  card.dataset.claim = result.claim.slice(0, 40);
  if (result.dominantSpeakerId !== null && result.dominantSpeakerId !== undefined) {
    card.dataset.speakerid = String(result.dominantSpeakerId);
  }
  card._resultData = result;

  const sourcesHTML = (result.sources ?? []).map((url, i) => {
    const isUrl = url.startsWith('http://') || url.startsWith('https://');
    return isUrl
      ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener">מקור ' + (i + 1) + '</a>'
      : '<span class="emet-source-text">' + escapeHtml(url) + '</span>';
  }).join('');

  const lexicalRows = buildLexicalRows(result.lexical);

  let speakerTag = '';
  if (!result.pending && allSpeakersConfirmed() && result.dominantSpeakerId !== null && result.dominantSpeakerId !== undefined) {
    const confirmedName = confirmedSpeakerMap[result.dominantSpeakerId];
    if (confirmedName) {
      const name = normalizeSpeakerName(confirmedName);
      const color2 = getSpeakerColor(name);
      speakerTag = '<div class="emet-speaker-tag" style="background:' + color2 + '">' + escapeHtml(name) + '</div>';
    }
  }

  card.innerHTML = [
    speakerTag,
    '<div class="emet-verdict-header">',
      '<span class="emet-badge emet-badge--' + color + '">' + escapeHtml(verdictLabel(result.verdict)) + '</span>',
      result.pending ? '<span class="emet-verifying">⟳ מאמת...</span>' : '',
      '<span class="emet-confidence-right">ודאות ' + escapeHtml(confidenceLabel(result.confidence)) + '</span>',
      '<span class="emet-timestamp">' + escapeHtml(result._timestamp || '') + '</span>',
      '<button class="emet-min-btn" title="מזער">▾</button>',
      '<button class="emet-hide-btn" title="הסתר פסיקה">✕</button>',
    '</div>',
    '<p class="emet-claim">"' + escapeHtml(result.claim) + '"</p>',
    '<p class="emet-explanation">' + escapeHtml(result.explanation) + '</p>',
    '<div class="emet-speaker-confidence">',
      '<button class="emet-speaker-toggle">',
        '<span class="emet-speaker-dot emet-speaker-dot--' + convictionColor + '"></span>',
        'ביטחון הדובר: ' + escapeHtml(confidenceLabel(result.speaker_confidence) || 'לא ידוע'),
        '<span class="emet-speaker-arrow">▾</span>',
      '</button>',
      '<div class="emet-speaker-explanation" style="display:none">',
        lexicalRows,
      '</div>',
    '</div>',
    result.pending ? '' : '<div class="emet-disclaimer">הערכה שנוצרה אוטומטית. בדקו את המקורות.</div>',
    (sourcesHTML && sourcesHTML.trim()) ? '<div class="emet-sources"><span class="emet-sources-label">מקורות:</span>' + sourcesHTML + '</div>' : '',
  ].join('');

  const toggleBtn = card.querySelector('.emet-speaker-toggle');
  const reasons   = card.querySelector('.emet-speaker-explanation');
  const arrow     = card.querySelector('.emet-speaker-arrow');
  toggleBtn.addEventListener('click', () => {
    const open = reasons.style.display === 'none';
    reasons.style.display = open ? 'block' : 'none';
    arrow.textContent = open ? '▴' : '▾';
  });

  const hideBtn = card.querySelector('.emet-hide-btn');
  hideBtn.addEventListener('click', () => {
    const nowHidden = card.classList.toggle('emet-verdict--hidden');
    hideBtn.textContent = nowHidden ? '+' : '✕';
    hideBtn.title = nowHidden ? 'החזר פסיקה' : 'הסתר פסיקה';
    updateHiddenBar();
  });

  const minBtn = card.querySelector('.emet-min-btn');
  const applyMinGlyph = () => {
    const min = card.classList.contains('emet-verdict--min');
    minBtn.textContent = min ? '◂' : '▾';
    minBtn.title = min ? 'הרחב' : 'מזער';
  };
  minBtn.addEventListener('click', () => {
    card.classList.toggle('emet-verdict--min');
    applyMinGlyph();
  });
  // לחיצה על שורת הטענה של כרטיס ממוזער מרחיבה אותו
  card.querySelector('.emet-claim').addEventListener('click', () => {
    if (card.classList.contains('emet-verdict--min')) {
      card.classList.remove('emet-verdict--min');
      applyMinGlyph();
    }
  });

  // לחיצה על חותמת הזמן מקפיצה את הסרטון לרגע שבו נאמרה הטענה
  if (result._timestamp) {
    const tsEl = card.querySelector('.emet-timestamp');
    tsEl.classList.add('emet-timestamp--link');
    tsEl.title = 'קפיצה לרגע הזה בסרטון';
    tsEl.addEventListener('click', () => {
      const parts = String(result._timestamp).split(':').map(Number);
      if (!parts.length || parts.some(isNaN)) return;
      const secs = parts.reduce((a, p) => a * 60 + p, 0);
      const video = document.querySelector('video');
      if (video) video.currentTime = secs;
    });
  }

  return card;
}

// שורת "מוסתרות" מתחת לרשימה - מאפשרת להציץ בפסיקות שהוסתרו ולהחזיר אותן
function updateHiddenBar() {
  if (!verdictListEl || !panel) return;
  let bar = panel.querySelector('#emet-hidden-bar');
  if (!bar) {
    bar = document.createElement('button');
    bar.id = 'emet-hidden-bar';
    bar.addEventListener('click', () => {
      verdictListEl.classList.toggle('emet-show-hidden');
      updateHiddenBar();
    });
    verdictListEl.insertAdjacentElement('afterend', bar);
  }
  const hiddenCount = verdictListEl.querySelectorAll('.emet-verdict--hidden').length;
  const showing = verdictListEl.classList.contains('emet-show-hidden');
  if (!hiddenCount) {
    verdictListEl.classList.remove('emet-show-hidden');
    bar.style.display = 'none';
    return;
  }
  bar.style.display = '';
  bar.textContent = showing
    ? 'סיימתי - הסתר שוב'
    : 'הצג ' + hiddenCount + ' פסיקות שהוסתרו';
}

function findPendingCard(claim, fastClaim) {
  if (fastClaim) {
    const fastKey = fastClaim.slice(0, 40);
    if (pendingCards.has(fastKey)) return pendingCards.get(fastKey);
  }

  const key = claim.slice(0, 40);
  if (pendingCards.has(key)) return pendingCards.get(key);

  const claimWords = claimWordsSet(claim);
  let bestCard = null, bestScore = 0;
  for (const [cardKey, card] of pendingCards) {
    const cardWords = [...claimWordsSet(cardKey)];
    const overlap = cardWords.filter(w => claimWords.has(w)).length;
    const score = overlap / Math.max(claimWords.size, cardWords.length);
    if (score > bestScore) { bestScore = score; bestCard = card; }
  }
  if (bestScore >= 0.4) return bestCard;
  return verdictListEl?.querySelector('.emet-verdict--pending');
}

function getVideoTimestamp() {
  const video = document.querySelector('video');
  if (!video) return '';
  const s = Math.floor(video.currentTime);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  return String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}

function getClaimTimestamp(claim) {
  if (!sentenceTimestamps.length) return lastTranscriptTimestamp || getVideoTimestamp();
  const claimWords = claimWordsSet(claim);
  let bestMatch = null, bestScore = 0;
  for (const entry of sentenceTimestamps) {
    const sentWords = [...claimWordsSet(entry.text)];
    const overlap = sentWords.filter(w => claimWords.has(w)).length;
    const score = overlap / Math.max(claimWords.size, sentWords.length);
    if (score > bestScore) { bestScore = score; bestMatch = entry; }
  }
  return bestScore >= 0.3 ? bestMatch.timestamp : (lastTranscriptTimestamp || getVideoTimestamp());
}

function addVerdict(result) {
  if (!verdictListEl) return;
  verdictListEl.querySelector('.emet-empty')?.remove();
  applyVerdictToBullet(result.claim, result.verdict, result.confidence);
  if (!result._timestamp) result._timestamp = getClaimTimestamp(result.claim);
  if (result.dominantSpeakerId !== null && result.dominantSpeakerId !== undefined) {
    result.dominantSpeakerId = String(result.dominantSpeakerId);
  }
  const card = buildCard(result);
  if (result.pending) {
    const key = result.claim.slice(0, 40);
    pendingCards.set(key, card);
    pendingCardTimes.set(key, Date.now());
  } else {
    logVerdict(result);
    updateSummaryBar();
  }
  verdictListEl.prepend(card);
}

function updateVerdict(result) {
  const existing = findPendingCard(result.claim, result._fastClaim);
  if (existing && existing._resultData?._timestamp) {
    result._timestamp = existing._resultData._timestamp;
  } else if (!result._timestamp) {
    result._timestamp = getClaimTimestamp(result.claim);
  }
  if (result.dominantSpeakerId !== null && result.dominantSpeakerId !== undefined) {
    result.dominantSpeakerId = String(result.dominantSpeakerId);
  }
  const newCard = buildCard(result);
  if (existing) {
    // שמירת מצב מזעור/הסתרה שהמשתמש קבע על הכרטיס הזמני
    for (const cls of ['emet-verdict--min', 'emet-verdict--hidden']) {
      if (existing.classList.contains(cls)) newCard.classList.add(cls);
    }
    if (newCard.classList.contains('emet-verdict--min')) {
      const b = newCard.querySelector('.emet-min-btn');
      b.textContent = '◂'; b.title = 'הרחב';
    }
    if (newCard.classList.contains('emet-verdict--hidden')) {
      const b = newCard.querySelector('.emet-hide-btn');
      b.textContent = '+'; b.title = 'החזר פסיקה';
    }
    existing.replaceWith(newCard);
    updateHiddenBar();
    for (const [k, v] of pendingCards) {
      if (v === existing) { pendingCards.delete(k); pendingCardTimes.delete(k); break; }
    }
  } else {
    verdictListEl?.querySelector('.emet-empty')?.remove();
    verdictListEl?.prepend(newCard);
  }
  applyVerdictToBullet(result.claim, result.verdict, result.confidence);
  logVerdict(result);
  updateSummaryBar();
}

function makeDraggable(panel) {
  const header = panel.querySelector('#emet-header');
  let isDragging = false, startX, startY, startLeft, startTop;
  header.addEventListener('mousedown', (e) => {
    if (e.target.id === 'emet-close' || e.target.id === 'emet-export') return;
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left; startTop = rect.top;
    header.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.right = 'unset';
    panel.style.left  = Math.max(0, startLeft + e.clientX - startX) + 'px';
    panel.style.top   = Math.max(0, startTop  + e.clientY - startY) + 'px';
  });
  document.addEventListener('mouseup', () => { isDragging = false; header.style.cursor = 'grab'; });
}

// ── הודעות ────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  console.log('[overlay] message received:', msg.type);
  switch (msg.type) {

    case 'START_FACTCHECK':
      createPanel();
      startSession();
      updateInterim('🎤 מפעיל תמלול...');
      speakers = parseSpeakersFromTitle(document.title || '');
      speakerColorMap.clear();
      try {
        chrome.runtime.sendMessage({
          type:  'PAGE_TITLE',
          title: document.title || '',
          date:  (() => {
            const el = document.querySelector('meta[itemprop="uploadDate"]') ||
                       document.querySelector('meta[property="og:updated_time"]') ||
                       document.querySelector('meta[property="article:published_time"]');
            return el ? new Date(el.content).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
          })(),
        });
      } catch (e) {}
      renderSpeakerEditor();
      break;

    case 'STOP_FACTCHECK':
      stopSession();
      removePanel();
      break;

    case 'TRANSCRIPT_RESULT':
      if (msg.interim) {
        updateInterim(msg.text);
      } else if (msg.isFinal) {
        const ts = getVideoTimestamp();
        lastTranscriptTimestamp = ts;
        sentenceTimestamps.push({ text: msg.text, timestamp: ts });
        if (sentenceTimestamps.length > MAX_TIMESTAMP_BUFFER) sentenceTimestamps.shift();
        clearInterim();
        const displayText = msg.text.replace(/^\[.*?\]\s*/, '');
        addTranscriptText(displayText);
        const labelMatch = msg.text.match(/^\[(.+?)\]/);
        if (labelMatch && speakers.includes(labelMatch[1])) {
          lastActiveSpeaker = labelMatch[1];
        }
      }
      break;

    case 'NEW_SPEAKER':
      if (panel) showSpeakerBanner(msg.speakerId, msg.sample || '');
      break;

    case 'WINDOW_EVALUATED': {
      // משוב חי: כמה קטעים נסרקו - כדי שיהיה ברור שהסורק עובד גם כשאין טענות
      windowsScanned++;
      const statusEl = panel?.querySelector('#emet-claims-status');
      if (statusEl) {
        statusEl.textContent = 'נסרקו ' + windowsScanned + ' קטעים - טרם זוהתה טענה הניתנת לבדיקה (דעות והצהרות אישיות מסוננות)';
      }
      break;
    }

    case 'TRANSCRIBER_STATUS': {
      let statusText = {
        'connecting':   '🎤 מתחבר לשירות התמלול...',
        'connected':    '🎤 התמלול פעיל - ממתין לדיבור...',
        'no-audio':     '⚠ לא נקלט קול מהטאב - ודאו שהסרטון מתנגן ולא מושתק',
        'disconnected': '⚠ התמלול התנתק',
      }[msg.state];
      if (statusText && msg.state === 'disconnected' && msg.detail) {
        statusText += ' (' + msg.detail + ')';
      }
      if (statusText) updateInterim(statusText);
      setStatusDot({ connecting: 'warn', 'no-audio': 'warn', disconnected: 'error', connected: '' }[msg.state] || '');
      break;
    }

    case 'PIPELINE_ERROR':
      showError(msg.message || 'אירעה שגיאה בצינור בדיקת העובדות.');
      break;

    case 'QUOTA_EXHAUSTED':
      showQuotaExplanation(msg.keyHelpUrl, msg.limitMin || 30);
      break;

    case 'NEW_VERDICT':
      if (msg.results) {
        for (const result of msg.results) {
          addClaimBullet(result.claim);
          addVerdict(result);
        }
      }
      break;

    case 'UPDATE_VERDICTS':
      if (msg.results) {
        for (const result of msg.results) {
          updateVerdict(result);
        }
      }
      break;
  }
});
