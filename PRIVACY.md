<div dir="rtl">

# מדיניות פרטיות - Emet

**עודכן לאחרונה: 20 באוגוסט 2026 · חל על גרסה 2.2.3 ואילך**

> הגרסה הקנונית והמפורסמת נמצאת ב-`store/privacy.html`. הקובץ הזה הוא מראה שלה. **שינוי באחד מחייב שינוי בשני** - אי-התאמה בין המדיניות המפורסמת להתנהגות בפועל היא עילת הסרה מחנות התוספים.

Emet ("אמת") מתמלל בזמן אמת את השמע של הטאב שאתם צופים בו, מזהה בו טענות עובדתיות, ומציג הערכה עם קישורים למקורות. **איננו יוצרים לכם חשבון, איננו מזהים אתכם, ואיננו שומרים את השמע או את התמלול שלכם.**

## שני מצבי הפעלה

**שירות משותף (ברירת המחדל).** כדי שלא תצטרכו להשיג מפתחות בעצמכם, הבקשות עוברות דרך שרת ביניים שאנחנו מפעילים - Cloudflare Worker בכתובת `emet-proxy.emet.workers.dev` - שמחזיק את מפתחות ה-API שלנו ומעביר לספקים. במצב הזה השמע והתמלול שלכם **כן** עוברים דרך תשתית שבשליטתנו.

**מפתח משלכם (הגדרות מתקדמות).** בחרתם מודל והזנתם מפתח? הבקשות עוברות **ישירות** מהדפדפן שלכם לספק. השרת שלנו אינו מעורב ואינו רואה דבר.

## מה נשמר במכשיר שלכם בלבד

- **מפתחות ה-API שלכם**, אם הזנתם - ב-`chrome.storage.local` בלבד. לעולם לא נשלחים אלינו, ולא לאף גורם מלבד הספק שאליו הם שייכים.
- **העדפות** - המודל שנבחר, מיקום וגודל הפאנל, כרטיסים שהוסתרו.
- **מונה שימוש יומי** - מספר דקות בלבד, לאכיפת המכסה. ללא היסטוריית צפייה.
- **מצב הסשן** - הטאב הפעיל וכותרת התוכן, ב-`chrome.storage.session`. נמחק בעצירה או בסגירת הדפדפן.

## מה נשלח, לאן

שום דבר אינו נשלח לפני לחיצה על "התחל בדיקת עובדות".

| מה | שירות משותף | מפתח משלכם |
|---|---|---|
| קטעי שמע של הטאב | לשרת שלנו → Groq (Whisper) | ישירות ל-Deepgram או Google AI |
| קטעי תמלול וכותרת התוכן | לשרת שלנו → Google Gemini או Groq | ישירות ל-Google AI / Anthropic / Groq |
| שאילתות חיפוש ראיות | לשרת שלנו → Serper (Google, אזור ישראל) | חיפוש מובנה במודל, או Bright Data |

## מה השרת שלנו רואה, ומה הוא שומר

- **איננו כותבים לדיסק שמע, תמלול או פסיקות.** כל בקשה מעובדת ונשכחת. אין לנו דרך לשחזר במה צפיתם.
- **אין מזהה משתמש.** הבקשות אינן נושאות שם, מייל, חשבון או מזהה מכשיר, ואיננו יכולים לקשור בקשות של אותו אדם.
- **כתובת ה-IP משמשת להגבלת קצב בלבד.** מונה יומי שנמחק אוטומטית אחרי 48 שעות, לא מקושר לתוכן, לא לזיהוי ולא לפרסום.
- **אין cookies, אין אנליטיקס, אין מעקב** - לא בתוסף ולא בשרת.

> **שקוף עד הסוף:** השירות המשותף פירושו שהשמע עובר דרך תשתית שבשליטתנו. אנחנו לא שומרים אותו - אבל אם אתם מעדיפים שלא יעבור דרכנו בכלל, פתחו «הגדרות מתקדמות», בחרו Gemini והזינו מפתח Google AI משלכם. מאותו רגע התקשורת ישירה בינכם לבין Google.

## מה איננו עושים

איננו מוכרים ואיננו משתפים נתונים - אין לנו מה למכור. איננו משתמשים בנתונים למטרה כלשהי מלבד הפעלת התוסף. איננו משתמשים בהם לכושר אשראי או להלוואות. איננו אוספים היסטוריית גלישה - התוסף פועל רק בעמוד שבו הפעלתם אותו במפורש. איננו מאמנים מודלים על התוכן שלכם.

## שירותי צד שלישי

[Google AI / Gemini](https://ai.google.dev/gemini-api/terms) · [Groq](https://groq.com/privacy-policy/) · [Serper](https://serper.dev/privacy-policy) · [Deepgram](https://deepgram.com/privacy) · [Anthropic](https://www.anthropic.com/legal/privacy) · [Bright Data](https://brightdata.com/privacy) · [Cloudflare](https://www.cloudflare.com/privacypolicy/)

## הרשאות

- **tabCapture** - לכידת שמע מהטאב, רק אחרי לחיצה מפורשת על "התחל בדיקת עובדות".
- **offscreen** - עיבוד שמע ברקע; ב-MV3 אין גישה ל-Web Audio API מתוך service worker.
- **storage** - שמירת העדפות ומפתחות מקומית.
- **activeTab** - הצגת פאנל התוצאות וקריאת כותרת העמוד לזיהוי דוברים.

## ילדים

התוסף אינו מיועד לילדים מתחת לגיל 13 ואינו אוסף מהם מידע ביודעין.

## שינויים

נעדכן את המסמך ואת התאריך שבראשו, ונודיע בתוך התוסף לפני שהשינוי ייכנס לתוקף.

## הצהרת עמידה במדיניות

השימוש שלנו בנתונים המתקבלים מממשקי Chrome, ושליחתם לגורמים אחרים, עומד ב-[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), לרבות דרישות ה-Limited Use.

## יצירת קשר

פתחו issue בעמוד הפרויקט ב-GitHub.

</div>

---

<div dir="ltr">

# Privacy Policy - Emet (English)

**Last updated: 20 August 2026 · Applies to version 2.2.3 and later**

Emet transcribes the audio of the tab you are watching, identifies factual claims in the Hebrew speech, and displays an assessment with links to sources. **We do not create an account for you, do not identify you, and do not store your audio or transcripts.**

## Two modes

**Shared service (default).** So you don't need API keys of your own, requests are relayed through a Cloudflare Worker we operate at `emet-proxy.emet.workers.dev`, which holds our provider keys and forwards to Groq (Whisper transcription and LLM), Google Gemini, and Serper (Google search results, region IL). In this mode your audio and transcripts do pass through infrastructure we control.

**Your own key (Advanced settings).** Requests go directly from your browser to the provider you chose. Our server is not involved and sees nothing.

## Stored on your device only

Your API keys (if supplied) in `chrome.storage.local` - never sent to us, and never to anyone other than the provider each key belongs to. Preferences: chosen model, panel position and size, hidden cards. A daily usage-minutes counter, a number only, with no history of what you watched. Session state (active tab, content title) in `chrome.storage.session`, cleared on stop or browser close.

## What is sent, and when

Nothing before you click "Start fact-checking". From then until you stop: tab audio chunks to the transcription service; transcript segments and the page title to the language model for claim detection and verification; search queries to the evidence-search service. In default mode these are relayed via our Worker; in bring-your-own-key mode they go directly to your chosen provider.

## What our server sees and keeps

Audio, transcripts and verdicts are **never written to disk** - each request is processed and forgotten. There is **no user identifier**: requests carry no name, email, account or device ID, and we cannot link one person's requests together. Your **IP address is used for rate limiting only** - a daily counter that expires automatically after 48 hours, not linked to any content and not used for identification, profiling or advertising. **No cookies, pixels, analytics or tracking**, in the extension or on the server.

## What we do not do

We do not sell or share data - we have none to sell. We do not use your data for any purpose other than operating the extension. We do not use it to determine creditworthiness or for lending purposes. We do not collect browsing history: the extension runs only on the page where you explicitly started it. We do not train models on your content.

## Third-party services

[Google AI / Gemini](https://ai.google.dev/gemini-api/terms) · [Groq](https://groq.com/privacy-policy/) · [Serper](https://serper.dev/privacy-policy) · [Deepgram](https://deepgram.com/privacy) · [Anthropic](https://www.anthropic.com/legal/privacy) · [Bright Data](https://brightdata.com/privacy) · [Cloudflare](https://www.cloudflare.com/privacypolicy/)

## Permissions

**tabCapture** - capture tab audio, only after you click Start. **offscreen** - process audio in the background; MV3 service workers cannot access the Web Audio API. **storage** - save your keys and preferences locally. **activeTab** - inject the results panel into the page you are watching and read its title to identify speakers.

## Children

Not directed at children under 13; we do not knowingly collect information from them.

## Changes

We will update this document and the date above, and notify you inside the extension before any change takes effect.

## Compliance statement

Our use of information received from Chrome APIs, and our transfer of that information to any other party, adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.

## Contact

Open an issue on the project's GitHub page.

</div>
