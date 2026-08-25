// offscreen.js - אמת (Emet)
// לוכד אודיו מהטאב ומזרים ל-Deepgram (מודל nova-3, עברית) לתמלול בזמן אמת.

let mediaStream = null;
let audioContext = null;
let audioSource = null;
let processor = null;
let socket = null;
let active = false;

// ── מצב תמלול Gemini (מפתח יחיד, מקטעים של ~15 שניות) ────────────────────────
let sttMode = 'deepgram';
let geminiSttKey = '';
let proxyUrl = '';
let chunkBuffers = [];   // מקטעי Int16Array ב-16kHz
let chunkSamples = 0;
let chunkPeak = 0;
let chunkTimer = null;
let sttInFlight = false;
const CHUNK_TARGET_SEC = 15;
const CHUNK_MAX_SEC = 30;

function downsampleTo16k(float32, srcRate) {
  const ratio = srcRate / 16000;
  const outLen = Math.floor(float32.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, float32.length - 1);
    const frac = pos - i0;
    const v = float32[i0] * (1 - frac) + float32[i1] * frac;
    out[i] = Math.max(-32768, Math.min(32767, v * 32768));
  }
  return out;
}

function buildWav(int16) {
  const n = int16.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const w = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n * 2, true);
  new Int16Array(buf, 44).set(int16);
  return buf;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function startChunkedSttPipeline() {
  processor = audioContext.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    const float32 = e.inputBuffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < float32.length; i++) {
      const v = float32[i];
      if (v > peak) peak = v; else if (-v > peak) peak = -v;
    }
    if (peak > chunkPeak) chunkPeak = peak;
    if (peak > 0.01) lastLoudTime = Date.now();
    const ds = downsampleTo16k(float32, audioContext.sampleRate);
    chunkBuffers.push(ds);
    chunkSamples += ds.length;
  };
  audioSource.connect(processor);
  processor.connect(audioContext.destination);

  sendStatus('connected');
  startSilenceWatch();
  clearInterval(chunkTimer);
  chunkTimer = setInterval(() => flushSttChunk(), 2000);
  console.log('[offscreen] chunked STT pipeline started (' + sttMode + ', ~' + CHUNK_TARGET_SEC + 's chunks)');
}

async function flushSttChunk() {
  if (!active) return;
  const secs = chunkSamples / 16000;
  if (secs < CHUNK_TARGET_SEC) return;
  if (sttInFlight && secs < CHUNK_MAX_SEC) return;

  const pieces = chunkBuffers;
  const total = chunkSamples;
  const peak = chunkPeak;
  chunkBuffers = [];
  chunkSamples = 0;
  chunkPeak = 0;

  // מקטע שקט - מדלגים ולא מבזבזים מכסה
  if (peak < 0.01) return;

  const all = new Int16Array(total);
  let off = 0;
  for (const p of pieces) { all.set(p, off); off += p.length; }
  const wav = buildWav(all);

  sttInFlight = true;
  try {
    const text = sttMode === 'hosted'
      ? await transcribeViaProxy(wav)
      : await transcribeViaGemini(wav);
    if (!text || text.includes('[שקט]')) return;

    // פיצול למשפטים כדי שחלון הטענות יתקדם באותו קצב כמו בתמלול חי
    const sentences = text.replace(/\s+/g, ' ').match(/[^.!?׃]+[.!?׃]?/g) || [text];
    for (const s of sentences) {
      const t = s.trim();
      if (t.length > 1) {
        chrome.runtime.sendMessage({ type: 'TRANSCRIPT_RESULT', text: t, isFinal: true, interim: false, speaker: null }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[offscreen] STT error:', err);
    chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'שגיאת תמלול: ' + err.message }).catch(() => {});
  } finally {
    sttInFlight = false;
  }
}

// תמלול דרך השרת המשותף (Groq Whisper) - שולחים WAV גולמי, אין מפתח משתמש
async function transcribeViaProxy(wav) {
  const res = await fetch(proxyUrl + '/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/wav' },
    body: wav,
  });
  if (res.status === 429) {
    const d = await res.json().catch(() => ({}));
    chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: d.message || 'הגעתם למכסה היומית של השירות המשותף.' }).catch(() => {});
    return '';
  }
  if (!res.ok) throw new Error('שרת תמלול (' + res.status + ')');
  return (await res.json()).text || '';
}

// תמלול דרך Gemini (מפתח משתמש) - inline base64
async function transcribeViaGemini(wav) {
  const b64 = arrayBufferToBase64(wav);
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiSttKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [
        { inline_data: { mime_type: 'audio/wav', data: b64 } },
        { text: 'Transcribe this Hebrew audio precisely, with punctuation. Return ONLY the transcription text, nothing else. If there is no clear speech, return exactly: [שקט]' },
      ] }],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });
  if (res.status === 429) {
    chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'מגבלת הקצב של Gemini הושגה - התמלול ימשיך בעוד רגע.' }).catch(() => {});
    return '';
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Gemini STT error');
  return (data.candidates?.[0]?.content?.parts ?? []).map(p => p.text || '').join('').trim();
}

// מגבלת ניסיונות חיבור מחדש - מונע לולאה אינסופית כשהחיבור נכשל שוב ושוב
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 4;

// אם החיבור נסגר עוד לפני שנפתח, כנראה שאחד הפרמטרים לא נתמך לעברית -
// בכל ניסיון חוזר מורידים פרמטרים: 0=מלא, 1=בלי זיהוי דוברים, 2=מינימלי
let paramLevel = 0;
let socketOpened = false;
let lastCloseInfo = '';
let keepAliveTimer = null;
let lastDeepgramKey = '';
let diagnosed = false;

// כשה-handshake נכשל הדפדפן מסתיר את הסיבה (קוד 1006) -
// בדיקת REST עם אותו מפתח חושפת אם הבעיה היא מפתח שגוי או קרדיט שנגמר
async function diagnoseHandshakeFailure() {
  if (diagnosed || !lastDeepgramKey) return;
  diagnosed = true;
  try {
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { 'Authorization': 'Token ' + lastDeepgramKey },
    });
    if (res.status === 401) {
      chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: '✗ אובחן: מפתח ה-Deepgram שגוי או בוטל. צרו מפתח חדש ב-console.deepgram.com, הדביקו בחלון התוסף ונסו שוב.' }).catch(() => {});
    } else if (res.ok) {
      chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: '✗ אובחן: מפתח ה-Deepgram תקין אך חיבור התמלול נדחה - ככל הנראה נגמר הקרדיט בחשבון. בדקו את היתרה ב-console.deepgram.com.' }).catch(() => {});
    }
  } catch (e) {
    console.error('[offscreen] diagnosis failed:', e);
  }
}

function buildDeepgramUrl(level, sampleRate) {
  const params = [
    'encoding=linear16',
    'sample_rate=' + sampleRate,
    'channels=1',
    'model=nova-3',
    'language=he',
    'punctuate=true',
    'interim_results=true',
    'smart_format=true',
  ];
  if (level <= 1) {
    params.push('utterance_end_ms=2500', 'vad_events=true');
  }
  if (level === 0) {
    params.push('diarize=true');
  }
  return 'wss://api.deepgram.com/v1/listen?' + params.join('&');
}

// דיווח מצב לפאנל - כדי שהמשתמש יראה מה קורה גם לפני שמגיע תמלול
function sendStatus(state, detail) {
  chrome.runtime.sendMessage({ type: 'TRANSCRIBER_STATUS', state, detail }).catch(() => {});
}

// זיהוי שקט: אם אין קול מהטאב, מודיעים למשתמש שהבעיה היא בסרטון ולא בתוסף
let lastLoudTime = 0;
let silenceInterval = null;
let silentNotified = false;

function startSilenceWatch() {
  lastLoudTime = Date.now();
  silentNotified = false;
  clearInterval(silenceInterval);
  silenceInterval = setInterval(() => {
    const silent = Date.now() - lastLoudTime > 8000;
    if (silent && !silentNotified) {
      sendStatus('no-audio');
      silentNotified = true;
    } else if (!silent && silentNotified) {
      sendStatus('connected');
      silentNotified = false;
    }
  }, 4000);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_CAPTURE') {
    startCapture(msg.streamId, msg)
      .then(() => sendResponse({ ok: true }))
      .catch(err => {
        console.error('[offscreen] error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (msg.type === 'STOP_CAPTURE') {
    stopCapture();
    sendResponse({ ok: true });
  }
});

let utteranceBuffer = '';
let utteranceSpeakerCounts = {};

// חשוב: ל-offscreen documents אין גישה ל-chrome.storage -
// המפתחות מגיעים מה-service worker בתוך הודעת START_CAPTURE.
async function startCapture(streamId, cfg) {
  if (active) stopCapture();
  active = true;

  sttMode = cfg.sttMode || (cfg.deepgramKey ? 'deepgram' : cfg.geminiKey ? 'gemini' : 'hosted');
  const deepgramKey = cfg.deepgramKey || '';
  geminiSttKey = cfg.geminiKey || '';
  proxyUrl = cfg.proxyUrl || '';
  diagnosed = false;  // אבחון מחדש בכל התחלה - המשתמש אולי תיקן את המפתח

  if (sttMode === 'deepgram' && !deepgramKey) {
    chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'מפתח Deepgram לא הוגדר - יש להזין אותו בחלון התוסף.' }).catch(() => {});
    throw new Error('Deepgram key not set');
  }
  if (sttMode === 'gemini' && !geminiSttKey) {
    chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'מפתח Google AI לא הוגדר - יש להזין אותו בחלון התוסף.' }).catch(() => {});
    throw new Error('Gemini key not set');
  }
  if (sttMode === 'hosted' && !proxyUrl) {
    chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'כתובת השרת המשותף לא הוגדרה.' }).catch(() => {});
    throw new Error('Proxy URL not set');
  }
  lastDeepgramKey = deepgramKey;

  // קבלת זרם האודיו של הטאב
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // tabCapture משתיק את הטאב - מחזירים את הסאונד לרמקולים מיד,
  // באיכות מלאה ובלי תלות בשירות התמלול
  audioContext = new AudioContext();
  if (audioContext.state === 'suspended') await audioContext.resume();
  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(audioContext.destination);
  audioSource = source;
  console.log('[offscreen] audio passthrough started at', audioContext.sampleRate, 'Hz | stt:', sttMode);
  sendStatus('connecting');

  if (sttMode === 'gemini' || sttMode === 'hosted') {
    // תמלול במקטעים (Gemini עם מפתח, או Groq Whisper דרך השרת) - אין WebSocket
    startChunkedSttPipeline();
    return;
  }

  // nova-3 הוא המודל הראשון של Deepgram שתומך בתמלול עברית בסטרימינג.
  // שולחים בקצב הדגימה המקורי של המערכת כדי לא לפגוע באיכות ההשמעה.
  socketOpened = false;
  const wsUrl = buildDeepgramUrl(paramLevel, audioContext.sampleRate);
  console.log('[offscreen] connecting to deepgram (param level ' + paramLevel + '):', wsUrl);
  socket = new WebSocket(wsUrl, ['token', deepgramKey]);

  socket.onopen = () => {
    console.log('[offscreen] deepgram connected (param level ' + paramLevel + ')');
    socketOpened = true;
    reconnectAttempts = 0;
    sendStatus('connected');
    startAudioPipeline();
    startSilenceWatch();
    // KeepAlive - מונע ניתוק אחרי ~10 שניות של שקט (למשל כשהסרטון מושהה)
    clearInterval(keepAliveTimer);
    keepAliveTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 8000);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'UtteranceEnd') {
        chrome.runtime.sendMessage({ type: 'UTTERANCE_END' });
        return;
      }

      const result = data.channel?.alternatives?.[0];
      if (!result || !result.transcript) return;

      const text    = result.transcript.trim();
      const isFinal = data.is_final;
      const speech  = data.speech_final;

      if (result.words?.length) {
        result.words.forEach(w => {
          if (w.speaker !== null && w.speaker !== undefined) {
            utteranceSpeakerCounts[w.speaker] = (utteranceSpeakerCounts[w.speaker] || 0) + 1;
          }
        });
      }

      function getDominantSpeaker() {
        const entries = Object.entries(utteranceSpeakerCounts);
        if (!entries.length) return null;
        return parseInt(entries.sort((a, b) => b[1] - a[1])[0][0]);
      }

      if (!text) return;

      if (isFinal && speech) {
        // סוף אמירה - שליחת הטקסט המצטבר כסופי
        const fullText = utteranceBuffer ? utteranceBuffer + ' ' + text : text;
        const speaker  = getDominantSpeaker();
        utteranceBuffer = '';
        utteranceSpeakerCounts = {};
        chrome.runtime.sendMessage({
          type:    'TRANSCRIPT_RESULT',
          text:    fullText.trim(),
          isFinal: true,
          interim: false,
          speaker,
        });
      } else if (isFinal && !speech) {
        utteranceBuffer += (utteranceBuffer ? ' ' : '') + text;
        chrome.runtime.sendMessage({
          type:    'TRANSCRIPT_RESULT',
          text:    utteranceBuffer,
          isFinal: false,
          interim: true,
          speaker: getDominantSpeaker(),
        });
      } else {
        chrome.runtime.sendMessage({
          type:    'TRANSCRIPT_RESULT',
          text,
          isFinal: false,
          interim: true,
          speaker: getDominantSpeaker(),
        });
      }

    } catch (err) {
      console.error('[offscreen] message parse error:', err);
    }
  };

  socket.onerror = (err) => {
    console.error('[offscreen] deepgram error:', err);
    chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'שגיאת תמלול - בדקו את מפתח ה-Deepgram.' }).catch(() => {});
  };
  socket.onclose = (e) => {
    console.log('[offscreen] deepgram closed:', e.code, e.reason, '| opened:', socketOpened, '| param level:', paramLevel);
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    lastCloseInfo = 'קוד ' + e.code + (e.reason ? ' - ' + e.reason : '');
    sendStatus('disconnected', lastCloseInfo);

    // 1008 = בעיית הרשאה (מפתח שגוי) - אין טעם לנסות שוב
    if (e.code === 1008) {
      chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'Deepgram דחה את החיבור (' + lastCloseInfo + '). בדקו שהמפתח תקין.' }).catch(() => {});
      return;
    }
    if (active) {
      // נסגר לפני שנפתח בכלל → מאבחנים את הסיבה האמיתית מול ה-REST API
      if (!socketOpened) {
        diagnoseHandshakeFailure();
        if (paramLevel < 2) {
          paramLevel++;
          console.log('[offscreen] handshake failed - dropping to param level', paramLevel);
        }
      }
      reconnectAttempts++;
      if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'החיבור ל-Deepgram נכשל שוב ושוב (' + lastCloseInfo + '). בדקו את המפתח ואת יתרת החשבון ב-console.deepgram.com, ונסו להפעיל מחדש.' }).catch(() => {});
        return;
      }
      chrome.runtime.sendMessage({ type: 'PIPELINE_ERROR', message: 'התמלול התנתק (' + lastCloseInfo + ') - מנסה שוב...' }).catch(() => {});
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'REQUEST_NEW_STREAM' }).catch(() => {});
      }, 1000 * reconnectAttempts);
    }
  };
}

// ההשמעה כבר רצה מ-startCapture; כאן רק מחברים את מעבד הדגימות לתמלול
function startAudioPipeline() {
  if (!audioContext || !audioSource) return;

  processor = audioContext.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (e) => {
    if (socket?.readyState !== WebSocket.OPEN) return;

    const float32 = e.inputBuffer.getChannelData(0);

    const int16 = new Int16Array(float32.length);
    let peak = 0;
    for (let i = 0; i < float32.length; i++) {
      const v = float32[i];
      if (v > peak) peak = v; else if (-v > peak) peak = -v;
      int16[i] = Math.max(-32768, Math.min(32767, v * 32768));
    }
    if (peak > 0.01) lastLoudTime = Date.now();

    socket.send(int16.buffer);
  };

  audioSource.connect(processor);
  // ל-ScriptProcessor נדרש חיבור ליעד כדי לפעול; הוא מוציא שקט ולא מכפיל את הסאונד
  processor.connect(audioContext.destination);
  console.log('[offscreen] transcription pipeline attached');
}

function stopCapture() {
  active = false;
  utteranceBuffer = '';
  utteranceSpeakerCounts = {};
  clearInterval(silenceInterval);
  silenceInterval = null;
  clearInterval(keepAliveTimer);
  keepAliveTimer = null;
  clearInterval(chunkTimer);
  chunkTimer = null;
  chunkBuffers = [];
  chunkSamples = 0;
  chunkPeak = 0;

  if (socket) {
    socket.close();
    socket = null;
  }

  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (audioSource) {
    audioSource.disconnect();
    audioSource = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  console.log('[offscreen] stopped');
}
