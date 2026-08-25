<div dir="rtl">

# Chrome Web Store - טופס ההגשה של Emet
**מעודכן: 20 באוגוסט 2026 · גרסה 2.2.3**

> **מיצוב שנקבע:** Emet הוא **כלי AI שמחפש ביסוס לטענות בחדשות** - לא פוסק אמת. כל טקסט במסמך הזה נכתב כך שהמילה "AI" והיעדר ההתחייבות לתוצאה יופיעו **בשם, בסיכום, בפתיחת התיאור, בממשק ובצילומי המסך** - ולא רק בשורת הסתייגות בסוף.

> ⚠ **לפני שממלאים משהו - קראו את סעיף 6.** ה-`PRIVACY.md` וה-`STORE_LISTING.md` הישנים אמרו "לתוסף אין שרתים משלו", והקוד סותר את זה מאז שנוסף ה-`HOSTED_PROXY_URL`. הגרסאות המעודכנות של שני הקבצים כבר נכתבו.

---

## 1. המשפט האחד שהכול נגזר ממנו

> **Emet מאתר טענות עובדתיות בשידורי חדשות בעברית, מחפש להן ביסוס ברשת בעזרת בינה מלאכותית, ומציג לכם את מה שהוא מצא - יחד עם המקורות.**

מה שהמשפט הזה עושה בשלוש מילים: **"מחפש ביסוס"**, לא "קובע". **"בעזרת בינה מלאכותית"**, לא במגיה אנושית. **"מציג לכם"**, כלומר ההכרעה נשארת אצל הקורא.

זה גם מה שהקוד עושה בפועל - `service-worker.js` שולח את הטענה לחיפוש, מקבל תוצאות, ומבקש מהמודל לשקול אותן (`Base the verdict primarily on the search evidence`). התיאור מתאר את המנגנון האמיתי, וזו בדיוק הדרישה של גוגל.

**ומה שאסור להגיד, אף פעם:** "מגלה שקרים" · "מזהה פייק ניוז" · "אומר לך אם זה נכון" · "מדויק ב-X%" · "בדוק ומאומת" · "חושף".

---

## 2. פרטי המוצר

### שם החבילה (Name) - מ-`manifest.json`, עד 75 תווים

השם הוא גורם הדירוג מספר 1 בחיפוש של החנות, והנוכחי מנצל 26 מתוך 75.

```
Emet - בדיקת עובדות עם AI בעברית: מחפש ביסוס לטענות בחדשות ובראיונות
```
*(68 תווים)*

```json
"name": "Emet - בדיקת עובדות עם AI בעברית: מחפש ביסוס לטענות בחדשות ובראיונות",
```

**"עם AI" נמצא בשם עצמו.** זה עושה שלושה דברים בבת אחת: מצהיר על טבע המוצר עוד לפני שמישהו לחץ, קונה מילת חיפוש בעלת נפח גבוה בחנות, וסוגר מראש כל טענה עתידית של "לא ידעתי שזה מכונה". המתחרה הישיר InTruth לא מזכיר AI בשום מקום בסיכום שלו - זה פער בולט.

### סיכום מהחבילה (Summary) - מ-`manifest.json` `description`, עד 132 תווים

```
AI שמאתר טענות עובדתיות בעברית ביוטיוב ובחדשות ומחפש להן ביסוס ומקורות. תמלול חי. בלי הרשמה. פלט אוטומטי - בדקו מקורות.
```
*(119 תווים)*

```json
"description": "AI שמאתר טענות עובדתיות בעברית ביוטיוב ובחדשות ומחפש להן ביסוס ומקורות. תמלול חי. בלי הרשמה. פלט אוטומטי - בדקו מקורות.",
```

ארבעה דברים דחוסים ל-119 תווים: **מה זה** (AI שמחפש ביסוס), **איפה** (יוטיוב וחדשות בעברית), **החיכוך שהוסר** (בלי הרשמה - המשתנה בעל ההשפעה הגדולה ביותר על התקנות לפי התחקור), ו**ההסתייגות** (פלט אוטומטי - בדקו מקורות). ההסתייגות נמצאת ב-132 התווים שכל אחד רואה בתוצאות החיפוש, לא קבורה בעמוד.

### תיאור (Detailed description) - השדה הריק בטופס

אסור להעתיק לכאן את הסיכום מילה במילה (ספאם, קוד Yellow Argon), ואסור לחזור על ביטוי מפתח יותר מ-4–5 פעמים. הנוסח הבא בודק את שניהם.

```
Emet ("אמת") הוא כלי בינה מלאכותית שמלווה אתכם בזמן צפייה בחדשות בעברית: הוא מתמלל את מה שנאמר, מאתר בתוכו טענות עובדתיות, מחפש להן ביסוס ברשת, ומציג לכם את מה שמצא - עם קישורים למקורות עצמם.

━━━ מה זה כן, ומה זה לא ━━━

זה כן: מנוע חיפוש ראיות שרץ בזמן אמת. אתם שומעים טענה, והוא כבר מביא לכם מה מופיע עליה ברשת ואיפה.

זה לא: פסיקה. אין כאן מערכת שקובעת מה נכון. יש מודל שפה שקורא תוצאות חיפוש ומסכם אותן, והוא - כמו כל מודל שפה - טועה. הסימון שמופיע על כרטיס הוא הערכה אוטומטית, לא הכרעה, ולא ביקורת אנושית.

לכן כל כרטיס מציג את המקורות שעליהם הוא נשען. הם החלק החשוב במסך. הסימון הוא רק דרך מהירה לדעת לאיזה כרטיס שווה להיכנס.

━━━ מה זה עושה ━━━

תמלול חי בעברית
הפאנל מציג את מה שנאמר תוך כדי, כולל הפרדה בין דוברים. שימושי גם בפני עצמו - לצפייה בלי קול, לסיכום ראיון, או כשקשה לעקוב.

איתור טענות
המערכת מחלצת אמירות שאפשר לחפש להן ביסוס - נתונים, סטטיסטיקות, אירועים, הצהרות מדיניות - ומסננת דעות, תחזיות והבטחות. עדיין יעברו לה דברים, ועדיין תיתפס לה אמירה שלא הייתה אמורה להיתפס.

חיפוש ראיות בשני שלבים
כרטיס ראשוני מופיע מיד לפי מה שהמודל כבר יודע, ומתעדכן אחרי חיפוש ברשת לפי מה שנמצא בפועל. הסימונים: נכון · נכון בעיקרו · לא נכון · מטעה. כל אחד מהם הוא הערכה של מודל, לא קביעה.

שיוך לדוברים
זיהוי הדוברים מכותרת התוכן, אישור ידני שלכם כשמופיע דובר חדש, ותיוג כל טענה לדובר שאמר אותה.

ניתוח שפה בעברית
מדד עזר שמראה כמה הדובר מסתייג ("אולי", "לדעתי"), כמה הוא נחרץ ("תמיד", "בוודאות"), מילות מילוי, שפה רגשית וקצב דיבור. זה תיאור של איך נאמר משהו, לא ראיה לגבי אם הוא נכון.

דוח מסכם
כפתור ייצוא מוריד דוח HTML בעברית, מקובץ לפי דוברים, עם כל המקורות.

━━━ מתחילים ━━━

1. מתקינים
2. פותחים סרטון או שידור
3. לוחצים על אייקון התוסף ואז "התחל בדיקת עובדות"

אין הרשמה, אין חשבון, אין כרטיס אשראי. 30 דקות ביום כלולות דרך שירות משותף. רוצים בלי הגבלה? בהגדרות המתקדמות אפשר לחבר מפתח Google AI משלכם (שתי דקות, בלי כרטיס אשראי).

━━━ איפה זה עובד ━━━

יוטיוב ואתרי החדשות הישראליים המרכזיים. מתאים במיוחד לראיונות אולפן, עימותים, מסיבות עיתונאים ונאומים.

━━━ מה קורה למידע ━━━

השמע והתמלול נשלחים לשירותי בינה מלאכותית חיצוניים לצורך התמלול והחיפוש, ואינם נשמרים אצלנו. מפתחות שהזנתם - אם הזנתם - נשמרים אך ורק בדפדפן שלכם. הפירוט המלא במדיניות הפרטיות המקושרת בעמוד הזה.

━━━ מגבלות, בלי לייפות ━━━

התמלול טועה. עברית מדוברת היא מהשפות הקשות לתמלול אוטומטי, ושגיאת תמלול אחת משנה טענה שלמה.

החיפוש חלקי. הוא מביא מה שמנועי החיפוש מחזירים באותו רגע, וזה לא בהכרח המקור הטוב ביותר או העדכני ביותר.

המודל טועה, ובביטחון. הוא עלול לפספס הקשר, לקרוא לא נכון מספר, או לסכם מקור בצורה שגויה - ולנסח את זה בדיוק באותו טון שבו הוא מנסח דברים נכונים.

איננו מתחייבים לנכונות של שום פלט של הכלי הזה. הוא נבנה כדי לחסוך לכם את החיפוש, לא כדי לחסוך לכם את השיפוט. אם משהו על המסך משנה לכם דעה - פתחו את המקור.

Emet אינו מחליף בדיקת עובדות מקצועית, ואינו קשור לאף גוף חדשות, מפלגה או ארגון.

קוד פתוח.
```

### קטגוריה
```
News & Weather
```
*(תחת Lifestyle. שם יושבים NewsGuard, Ground News ו-InVID WeVerify.)*

### שפה
```
עברית (Hebrew)
```
לא פורמליות - ההחלטה הכי משפיעה בטופס. כל תוסף שמשרת קהל ישראלי אבל רשום באנגלית תקוע סביב 1,000 משתמשים; היחיד שנרשם בעברית מלאה ("שם זה זול יותר") הגיע ל-60,000.

---

## 3. איפה עוד המיצוב חייב להופיע - לא רק בליסטינג

מדיניות גוגל בודקת **התאמה** בין מה שכתוב בחנות למה שהמוצר עושה. תיאור זהיר עם ממשק שמכריז "לא נכון" באדום גדול בלי הקשר הוא בדיוק אי-ההתאמה שסוקר מחפש. שלוש נקודות חובה:

**א. כותרת הפאנל.** מתחת ל"Emet" בפאנל הצף, שורת מיקרו-קופי קבועה:
```
בדיקה אוטומטית עם AI · המקורות למטה
```

**ב. תחתית כל כרטיס פסיקה**, בגופן קטן, מעל קישורי המקורות:
```
הערכה שנוצרה אוטומטית. בדקו את המקורות.
```
זה גם מה שגורם להסתייגות להופיע **בתוך צילום המסך** בלי מאמץ נוסף - ראו סעיף 4.

**ג. מסך ההסכמה הראשון.** נדרש ממילא מאז עדכון המדיניות של 1 באוגוסט 2026 (חשיפה בולטת + הסכמה מודעת לפני הלכידה הראשונה). נצלו אותו כדי לומר את שני הדברים יחד:
```
לפני שמתחילים

Emet מקליט את השמע של הטאב הזה ושולח אותו לשירותי בינה
מלאכותית חיצוניים כדי לתמלל אותו ולחפש ביסוס לטענות שנאמרות בו.
השמע לא נשמר.

מה שיופיע על המסך נוצר אוטומטית על ידי מודל שפה, עלול להיות
שגוי או חלקי, ואינו בדיקת עובדות אנושית. כל כרטיס מציג את
המקורות שלו - הם הדבר שכדאי לקרוא.

[ הבנתי, בואו נתחיל ]
```

**ד. דוח הייצוא.** הדוח יוצא מהתוסף ומגיע לאנשים שלא ראו שום מסך הסכמה. שורה בראשו:
```
דוח שנוצר אוטומטית על ידי Emet בעזרת בינה מלאכותית.
ההערכות בו לא נבדקו על ידי אדם. בדקו את המקורות המצורפים.
```
זו הנקודה שהכי קל לשכוח והכי יקר לפספס - צילום מסך של דוח בלי השורה הזו יכול להסתובב ברשת בלי שום הקשר.

---

## 4. נכסים גרפיים

| נכס | מידות | חובה? | סטטוס |
|---|---|---|---|
| סמל החנות | 128×128 PNG | ✅ | קיים - `assets/icon128.png` |
| צילומי מסך | 1280×800 (או 640×400), 1–5 | ✅ | ⬜ ליצור |
| תמונת קידום קטנה | 440×280 PNG/JPEG | ✅ **בפועל** | ⬜ ליצור |
| Marquee | 1400×560 | רשות | דלגו |

**על ה-440×280 אל תדלגו.** גוגל מנסחת מפורשות: *"Extensions that don't have a small promotional image will be shown after extensions that do have that image."* על ה-Marquee כן אפשר לוותר - מדיניות Featured Products שוללת מראש *"Religious or political content"*, כך שממילא לא תוצגו שם.

### תסריט לארבעה צילומי מסך

צלמו על תוכן אמיתי, 1280×800 בדיוק, עם התוסף רץ. **אסור מוקאפים או קולאז'ים שיווקיים** - צילום שלא משקף את המוצר הוא עילת דחייה (Red Nickel).

1. **הכרטיס והמקורות** - פאנל פתוח על ראיון, כרטיס אחד עם 2–3 קישורי מקורות **גלויים ובולטים**, ותחתיו "הערכה שנוצרה אוטומטית. בדקו את המקורות." כותרת-על: **"טענה, מה נמצא עליה ברשת, והמקורות עצמם"**
2. **התמלול** - התמלול החי עם הפרדת דוברים והבאנר "זוהה דובר חדש - מי זה?". כותרת: **"תמלול חי בעברית, מופרד לפי דוברים"**
3. **אפס הגדרות** - הפופאפ עם הבאנר הירוק "✓ מוכן לשימוש" וכפתור ההתחלה. כותרת: **"בלי הרשמה. בלי מפתח. לוחצים ומתחילים."**
4. **הדוח** - דוח ה-HTML המיוצא עם שורת ההסתייגות בראשו. כותרת: **"דוח מסכם עם כל המקורות, לייצוא"**

**כלל בל יעבור:** בצילום 1 - הקישורים למקורות תופסים יותר שטח מסך מהתווית הצבעונית, וההסתייגות קריאה. צילום שמראה ✗ אדום גדול על פניו של פוליטיקאי בלי מקורות ובלי הסתייגות הוא בדיוק המסמך שסוקר יצרף להודעת הדחייה.

---

## 5. לשונית Privacy practices

### תיאור המטרה היחידה (Single purpose)
```
Emet has one purpose: to help a viewer find evidence for factual claims made in Hebrew-language news content.

It transcribes the audio of the tab the user is watching, uses an AI model to identify statements that can be checked, runs web searches for each one, and displays what the search returned together with links to the sources themselves.

The extension is explicitly not an authority on truth. All assessments are generated automatically by a large language model, are not reviewed by a human, may be incorrect or incomplete, and are presented alongside their sources so the user can evaluate them independently. This is stated in the store description, in an in-product consent screen shown before the first capture, on every verdict card, and in the exported report. The developer makes no warranty as to the correctness of any output.
```

### הצדקת הרשאות

**tabCapture**
```
Captures audio from the active tab only after the user explicitly clicks "Start fact-checking" in the extension popup and accepts an in-product consent screen. The audio is required to transcribe the spoken Hebrew, which is the input to the claim-detection and evidence-search steps. Capture stops when the user clicks Stop, closes the tab, or the daily quota is reached. No audio is recorded to disk or retained after transcription.
```

**offscreen**
```
Manifest V3 service workers have no access to the Web Audio API. The extension creates an offscreen document solely to resample the captured tab audio and stream it to the transcription service. The offscreen document also routes the audio back to the output device so the tab does not go silent for the user during capture.
```

**storage**
```
Stores the user's preferences (selected model, panel position and size, hidden cards), a local counter of daily usage minutes so the free quota can be enforced client-side, and - only if the user chooses to supply them - their own API keys, in chrome.storage.local. Nothing in chrome.storage is transmitted to the developer.
```

**activeTab**
```
Injects the results panel - live transcript, detected claims, AI-generated assessments and the source links each one is based on - into the page the user is watching, and reads the page title in order to identify the speakers appearing in the content.
```

### הצדקת host permissions
```
https://*.workers.dev/* - the extension's own Cloudflare Worker, which by default relays transcription, claim-detection and web-search requests so that users are not required to obtain API keys of their own. It holds the developer's provider keys and forwards to Groq (Whisper transcription and LLM), Google Gemini, and Serper (Google search results, region IL). Only the audio chunk or transcript segment being processed is sent; no user identifier is attached. The request IP is used solely for per-IP daily rate limiting and expires automatically after 48 hours.

https://generativelanguage.googleapis.com/*, https://api.anthropic.com/*, https://api.groq.com/*, https://api.deepgram.com/* and wss://api.deepgram.com/*, https://api.brightdata.com/* - used only when a user opts out of the shared service and enters their own API key in Advanced Settings. In that mode the request goes directly from the user's browser to the chosen provider with the user's own key, and the extension's own server is not involved at all. No other hosts are contacted.
```

### קוד מרוחק
```
No, I am not using remote code.
```
✅ אימתתי: אין `eval`, אין `<script src>` חיצוני, אין CDN. **אל תמזערו את הקוד** לפני ההגשה - מזעור מותר אבל מאריך את הבדיקה.

### שימוש בנתונים - קבוצת התיבות הראשונה

סמנו **בדיוק** את אלה:

- ☑ **Website content** - השמע של הטאב, התמלול שהופק ממנו, וכותרת העמוד. הקטגוריה כוללת בהגדרתה `sounds` ו-`videos`.
- ☑ **Authentication information** - מפתחות API שהמשתמש מזין, אם בחר בכך. גם אם אינם עוזבים את המכשיר, מפתח API הוא authentication information; לסמן ולהסביר קורא הרבה יותר טוב מאשר להשמיט.
- ☑ **User activity** - הטאב הפעיל ומספר הדקות שרצו, לאכיפת המכסה.

**אל תסמנו:** Health · Financial · Location · Web history · Personal communications · Personally identifiable information.

> **על Personal communications:** התיבה מיועדת למיילים, הודעות וצ'אטים. ה-`content_scripts` שלכם מוגבל ליוטיוב ולשבעה אתרי חדשות, ואין ביניהם פלטפורמת תקשורת. **אם תרחיבו ל-`<all_urls>` או תוסיפו Meet / Zoom / Discord - היא הופכת לחובה**, וזו גם נקודת השבירה שבה הבדיקה תתארך משמעותית.

### קבוצת ההסמכה
סמנו את שלושתן - כולן נכונות: לא נמכר · לא משמש למטרות שאינן ליבה · לא לכושר אשראי.

### כתובת מדיניות הפרטיות
```
https://<your-github-username>.github.io/emet-factcheck/privacy.html
```
הקובץ `privacy.html` מעודכן ומצורף. Settings → Pages → Source: `main` / `/docs`. הכתובת חייבת להיות פעילה **לפני** ההגשה - סוקר שנוחת על 404 דוחה אוטומטית.

---

## 6. לשונית Test instructions - הפעולה בעלת התשואה הגבוהה ביותר

הסיבה הנפוצה ביותר לתקיעות של שבועות היא סוקר שלא הצליח להריץ. אצלכם ברירת המחדל עובדת בלי מפתח - אמרו את זה מפורשות:

```
No credentials are required. The extension works out of the box.

1. Install and open this video (Hebrew political interview):
   https://www.youtube.com/watch?v=<INSERT A STABLE VIDEO ID>
2. Press play and let it run.
3. Click the Emet toolbar icon. The popup shows a green banner reading
   "מוכן לשימוש" (ready to use) - no key entry is needed.
4. Click the button "התחל בדיקת עובדות" (Start fact-checking).
5. A consent screen appears explaining that tab audio is sent to
   third-party AI services and that all output is machine-generated
   and unverified. Accept it.
6. A floating panel appears on the right. The live Hebrew transcript
   begins within ~10 seconds; the first claim cards appear within
   ~30-60 seconds of continuous speech.
7. Each card shows the claim, an AI-generated assessment, the source
   links the assessment is based on, and a fixed notice reading
   "הערכה שנוצרה אוטומטית. בדקו את המקורות."
   ("Automatically generated assessment. Check the sources.")

The extension does not present itself as an authority on truth. It is
an evidence-retrieval tool: it locates checkable statements and shows
what a web search returns for each, with links. This framing appears
in the store description, the consent screen, every card, and the
exported report.

The default mode relays through the developer's own Cloudflare Worker
(emet-proxy.emet.workers.dev), which holds the provider keys, so no
reviewer setup is needed. 30 minutes of use per day are included.

Optional: to test bring-your-own-key mode, expand "הגדרות מתקדמות"
(Advanced settings), pick a Gemini model, and paste a Google AI
Studio key. In that mode no request touches our server.

The extension is Hebrew-language. UI labels above are given in Hebrew
as they appear on screen.
```

---

## 7. פערים לסגור לפני ההגשה

### 🔴 חוסם: המסמכים אומרים שאין שרת, ויש שרת
`PRIVACY.md` ו-`store/privacy.html` הישנים הצהירו *"לתוסף אין שרתים משלו"*. הקוד סותר: `service-worker.js:6` מגדיר `HOSTED_PROXY_URL`, ובברירת המחדל כל השמע עובר דרכו, וה-Worker שומר IP ב-KV ל-48 שעות. מדיניות שסותרת התנהגות היא מהעילות המהירות ביותר להסרה (Purple Lithium). **הקבצים המעודכנים מצורפים.**

### 🔴 חוסם: הטקסטים בסעיף 3 צריכים להיכתב בקוד
המיצוב שביקשת אינו טקסט לחנות בלבד - הוא ארבע מחרוזות בממשק. **מסך ההסכמה נדרש ממילא מאז 1 באוגוסט 2026**, אז ממילא צריך לגעת בקוד. תוסיפו את שאר השלוש באותה נגיעה.

### 🟠 הטענה שמצילה אתכם - ולמה היא גם עובדת שיווקית
המדיניות אוסרת *"products that deceive or mislead users, including in the content, title, description"* ומביאה כדוגמה מוצר שמבטיח יכולת שאין לו. הבחירה שלך במיצוב "כלי AI שמחפש ביסוס, בלי התחייבות" פותרת את זה - ולא רק משפטית.

מחקר CHI 2026 על 274 אנשי מקצוע בתקשורת מצא שכשלא נאמר במפורש שהבדיקה נוצרה על ידי מודל, הדירוג של אותו טקסט עצמו **ירד** (p=.027). וכשנשאלו מה שובר את האמון, ההסתייגות הכי חוזרת הייתה על **טון**: *"AI should not speak with an authoritative tone as if it is able to access all data available in the world."* בדיוק הבעיה שהמיצוב הזה מונע.

הבונוס: **תלונות "אתה מוטה" הן צורת התלונה הכי נפוצה על כלים כאלה** - ראו הביקורות על Media Bias Fact Check ו-NewsGuard ב-`RESEARCH.md`. כלי שמעולם לא טען לפסוק, ושמראה את המקורות בגדול, קשה בהרבה לתקוף.

### 🟡 השתקת הטאב
`tabCapture` משתיק את הטאב אלא אם מנתבים את השמע חזרה דרך `AudioContext` ל-destination. אם זה לא מיושם ב-`offscreen.js` - זו ביקורת של כוכב אחד ביום הראשון.

### 🟡 טענת "קוד פתוח"
אם התיאור אומר "קוד פתוח", המאגר צריך להיות ציבורי בזמן ההגשה. אחרת הורידו את השורה.

### 🟡 גיבוי מפתחות לקובץ
כפתור "⬇ גיבוי מפתחות" מוריד JSON עם מפתחות בטקסט גלוי. לגיטימי ולא אסור - אבל בהקשר של גל 2025–26 של תוספי AI מזויפים שגנבו מפתחות OpenAI, סוקר עלול להיתקל בזה ולעצור. שקלו אזהרה ליד הכפתור.

---

## 8. מה לצפות בבדיקה

מפתח חדש + `tabCapture` + `offscreen` + host permissions מרובים + נושא פוליטי = **2–3 שבועות לבדיקה הראשונה.** אל תגישו מחדש כדי "לזרז את התור" - זה מאפס את הבדיקה. מעל שלושה שבועות: פנו לתמיכה למפתחים.

**ערעורים: אחד בלבד לכל הפרה.** אם נדחים - קראו את קוד ההפרה, תקנו לגמרי, הגישו מחדש. אל תבזבזו את הערעור על סבב ראשון.

</div>
