// lexical-features.js - אמת (Emet)
// חילוץ סמני מחויבות של דובר מטקסט תמלול בעברית

// -- רשימות מילים

const EMET_EXCLUSIVE_WORDS = new Set([
  'אבל', 'אולם', 'אך', 'למרות', 'חוץ', 'מלבד', 'בלי', 'ללא', 'אלא',
  'לעומת', 'זאת', 'אף', 'למעט', 'ובכל',
]);

const EMET_HEDGING_WORDS = new Set([
  'אולי', 'כנראה', 'ייתכן', 'יתכן', 'בערך', 'איכשהו', 'לכאורה', 'כביכול',
  'לדעתי', 'נדמה', 'נראה', 'חושב', 'חושבת', 'מניח', 'מניחה', 'מאמין', 'מאמינה',
  'משהו', 'כזה', 'בסביבות', 'פחות', 'יותר',
]);

const EMET_CERTAINTY_WORDS = new Set([
  'תמיד', 'לעולם', 'בוודאות', 'בוודאי', 'בטוח', 'בטוחה', 'ברור', 'ברורה',
  'לחלוטין', 'מוכח', 'עובדה', 'עובדות', 'ראיות', 'מחקר', 'מחקרים', 'נתונים',
  'סטטיסטיקה', 'אחוז', 'אחוזים', 'מיליון', 'מיליארד', 'כולם', 'הכל', 'אף',
  'מובטח', 'חד-משמעית',
]);

const EMET_EMOTIONAL_WORDS = new Set([
  'נורא', 'איום', 'איומה', 'מדהים', 'מדהימה', 'פנטסטי', 'אסון', 'קטסטרופה',
  'נפלא', 'לא-ייאמן', 'מזעזע', 'שערורייה', 'בושה', 'חרפה', 'מגוחך', 'פתטי',
  'אוהב', 'אוהבת', 'שונא', 'שונאת', 'פחד', 'כועס', 'כועסת', 'עצוב', 'שמח',
  'גאה', 'מטורף', 'הזוי', 'מושחת', 'מושחתת', 'רשע', 'גרוע', 'נהדר',
]);

const EMET_FILLER_WORDS = new Set([
  'אה', 'אמ', 'אממ', 'אהה', 'כאילו', 'בעצם', 'תכלס', 'יעני', 'בקיצור',
  'אוקיי', 'טוב', 'זהו', 'נו', 'בסדר', 'תשמע', 'תשמעי', 'תקשיב', 'תקשיבי',
]);

const EMET_FP_SINGULAR = new Set(['אני', 'שלי', 'לי', 'אותי', 'עצמי', 'ממני', 'בי']);
const EMET_FP_PLURAL   = new Set(['אנחנו', 'אנו', 'שלנו', 'לנו', 'אותנו', 'עצמנו']);
const EMET_THIRD_PERSON = new Set([
  'הוא', 'היא', 'הם', 'הן', 'שלו', 'שלה', 'שלהם', 'שלהן',
  'אותו', 'אותה', 'אותם', 'אותן', 'לו', 'לה', 'להם', 'להן',
]);

// -- החילוץ הראשי

/**
 * חילוץ סמני מחויבות לקסיקליים מקטע תמלול עברי
 * @param {string} text - קטע התמלול
 * @param {number} durationSeconds - משך משוער (אופציונלי, לקצב דיבור)
 * @returns {object|null} אובייקט מאפיינים
 */
function extractLexicalFeatures(text, durationSeconds) {
  const cleaned = text.replace(/["'׳״.,:;!?()\-]/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount === 0) return null;

  let exclusiveCount  = 0;
  let hedgingCount    = 0;
  let certaintyCount  = 0;
  let emotionalCount  = 0;
  let fillerCount     = 0;
  let firstPersonSing = 0;
  let firstPersonPlur = 0;
  let thirdPerson     = 0;

  // הסרת אותיות שימוש (ו, ה, ש, כ, ב, ל, מ) בתחילת מילה לצורך התאמה
  const stripPrefix = w => w.length > 3 ? w.replace(/^[ושהבלכמ]/, '') : w;

  for (const raw of words) {
    const candidates = [raw, stripPrefix(raw)];
    if (candidates.some(w => EMET_EXCLUSIVE_WORDS.has(w)))  exclusiveCount++;
    if (candidates.some(w => EMET_HEDGING_WORDS.has(w)))    hedgingCount++;
    if (candidates.some(w => EMET_CERTAINTY_WORDS.has(w)))  certaintyCount++;
    if (candidates.some(w => EMET_EMOTIONAL_WORDS.has(w)))  emotionalCount++;
    if (candidates.some(w => EMET_FILLER_WORDS.has(w)))     fillerCount++;
    if (EMET_FP_SINGULAR.has(raw))   firstPersonSing++;
    if (EMET_FP_PLURAL.has(raw))     firstPersonPlur++;
    if (EMET_THIRD_PERSON.has(raw))  thirdPerson++;
  }

  // ביטויים מרובי-מילים
  const lower = ' ' + cleaned + ' ';
  if (lower.includes(' אני חושב '))  hedgingCount++;
  if (lower.includes(' אני מאמין ')) hedgingCount++;
  if (lower.includes(' נדמה לי '))   hedgingCount++;
  if (lower.includes(' יכול להיות ')) hedgingCount++;
  if (lower.includes(' אתה יודע '))  fillerCount++;
  if (lower.includes(' את יודעת '))  fillerCount++;

  // -- שיעורים (ל-100 מילים)

  const per100 = (n) => parseFloat(((n / wordCount) * 100).toFixed(1));

  const wordsPerSecond = durationSeconds && durationSeconds > 0
    ? parseFloat((wordCount / durationSeconds).toFixed(1))
    : null;

  const avgWordLength = parseFloat(
    (words.reduce((sum, w) => sum + w.length, 0) / wordCount).toFixed(1)
  );

  // -- ציון מחויבות (היוריסטיקה בין 1- ל-1+)
  // חיובי = מחויבות גבוהה; שלילי = מחויבות נמוכה

  const commitmentScore = parseFloat((
    (certaintyCount * 0.3)
    + (firstPersonSing * 0.15)
    - (hedgingCount * 0.4)
    - (fillerCount * 0.25)
    - (emotionalCount * 0.1)
    + (exclusiveCount * 0.1)
  ).toFixed(2));

  const commitmentLabel =
    commitmentScore >  0.3 ? 'HIGH'   :
    commitmentScore < -0.3 ? 'LOW'    :
                             'MEDIUM';

  return {
    wordCount,
    wordsPerSecond,
    avgWordLength,
    rates: {
      hedging:       per100(hedgingCount),
      certainty:     per100(certaintyCount),
      emotional:     per100(emotionalCount),
      filler:        per100(fillerCount),
      exclusive:     per100(exclusiveCount),
      firstPersonSg: per100(firstPersonSing),
      firstPersonPl: per100(firstPersonPlur),
      thirdPerson:   per100(thirdPerson),
    },
    commitmentScore,
    commitmentLabel,
    summary: buildLexicalFeatureSummary({
      wordCount, wordsPerSecond, hedgingCount, certaintyCount,
      emotionalCount, fillerCount, exclusiveCount,
      firstPersonSing, firstPersonPlur, commitmentLabel
    })
  };
}

function buildLexicalFeatureSummary({ wordCount, wordsPerSecond, hedgingCount, certaintyCount,
  emotionalCount, fillerCount, exclusiveCount, firstPersonSing,
  firstPersonPlur, commitmentLabel }) {

  const parts = [];

  if (wordsPerSecond !== null) {
    const rateDesc = wordsPerSecond > 3.5 ? 'fast' : wordsPerSecond < 2 ? 'slow' : 'moderate';
    parts.push(`speech rate: ${wordsPerSecond} words/sec (${rateDesc})`);
  }

  if (hedgingCount > 0)   parts.push(`${hedgingCount} hedging expressions (e.g. "אולי", "לדעתי")`);
  if (fillerCount > 0)    parts.push(`${fillerCount} filler words (e.g. "אה", "כאילו")`);
  if (certaintyCount > 0) parts.push(`${certaintyCount} certainty markers (e.g. "תמיד", "בוודאות", statistics)`);
  if (emotionalCount > 0) parts.push(`${emotionalCount} emotional words`);
  if (exclusiveCount > 0) parts.push(`${exclusiveCount} exclusive/qualifying words (e.g. "אבל", "למרות")`);
  if (firstPersonSing > 0) parts.push(`${firstPersonSing} first-person singular pronouns (אני/שלי)`);
  if (firstPersonPlur > 0) parts.push(`${firstPersonPlur} first-person plural pronouns (אנחנו/שלנו)`);

  return parts.length
    ? `Lexical features: ${parts.join(', ')}. Overall commitment: ${commitmentLabel}.`
    : `No strong commitment signals detected. Overall commitment: ${commitmentLabel}.`;
}
