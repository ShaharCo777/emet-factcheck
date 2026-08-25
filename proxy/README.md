<div dir="rtl">

# שרת Emet - פריסה ב-Cloudflare Workers

השרת הזה מחזיק את מפתחות ה-API שלך ומעביר בקשות מהתוסף, כדי שמשתמשי הקצה **לא יצטרכו מפתח משלהם**. עלות האירוח: **₪0** (Cloudflare Workers חינם עד 100,000 בקשות/יום). אתה משלם רק על Groq + Serper לפי שימוש בפועל.

## מה צריך (10-15 דקות, חד-פעמי)

1. **חשבון Cloudflare** (חינם) - [dash.cloudflare.com](https://dash.cloudflare.com)
2. **מפתח Groq** (תמלול + מודל) - [console.groq.com/keys](https://console.groq.com/keys)
3. **מפתח Serper** (חיפוש) - [serper.dev](https://serper.dev) (2,500 חיפושים חינם)
4. **Node.js** מותקן במחשב

## פריסה

מהתיקייה `proxy/`:

```bash
# 1. התקנת הכלי של Cloudflare
npm install -g wrangler

# 2. התחברות (נפתח דפדפן)
wrangler login

# 3. יצירת KV להגבלת קצב (מונע ניצול לרעה + מגן על התקציב)
wrangler kv namespace create EMET_KV
#    העתיקו את ה-id שמודפס, והדביקו אותו ב-wrangler.toml
#    (בטלו את ההערה של הבלוק [[kv_namespaces]] והכניסו את ה-id)

# 4. הגדרת הסודות (לא נשמרים בקוד)
wrangler secret put GROQ_API_KEY
#    הדביקו את מפתח ה-Groq כשמתבקש
wrangler secret put SERPER_API_KEY
#    הדביקו את מפתח ה-Serper

# 5. פריסה!
wrangler deploy
```

בסוף תקבלו כתובת כמו:
```
https://emet-proxy.YOUR-NAME.workers.dev
```

## חיבור התוסף לשרת

בקובץ `src/background/service-worker.js`, בראש הקובץ, עדכנו:

```js
const HOSTED_PROXY_URL = 'https://emet-proxy.YOUR-NAME.workers.dev';
```

וב-`src/background/service-worker.js` (או בהגדרות), עדכנו גם את קישור הקרדיט:

```js
const ATTRIBUTION_URL  = 'https://www.linkedin.com/in/YOUR-PROFILE';
```

בנו מחדש (`./build.sh`) והעלו לחנות.

## שליטה בתקציב

בראש `worker.js`:

```js
const DAILY_IP_LIMIT     = 400;    // בקשות ליום לכל משתמש
const DAILY_GLOBAL_LIMIT = 30000;  // תקרה יומית כוללת = תקרת ההוצאה שלך
```

- ~140 בקשות ≈ שעת בדיקה אחת.
- `DAILY_GLOBAL_LIMIT = 30000` ≈ 210 שעות-משתמש ביום, מקסימום ~$50/יום.
- **רוצה תקרה נמוכה יותר?** הקטן את המספר. למשל 3,000 ≈ ~$5/יום מקסימום.

אחרי כל שינוי: `wrangler deploy`.

## מעקב הוצאות

- **Groq**: [console.groq.com](https://console.groq.com) - Usage
- **Serper**: [serper.dev](https://serper.dev) - יתרת קרדיטים
- **Cloudflare**: הדשבורד מראה בקשות/יום (עד 100K חינם)

## עלות משוערת

| שימוש | עלות חודשית משוערת |
|---|---|
| 50 משתמשים × 3 שעות/שבוע | ~$150 |
| 200 משתמשים × 2 שעות/שבוע | ~$400 |

רוב העלות היא Groq (תמלול+מודל) + Serper (חיפוש). התקרות למעלה שומרות שלא תיפול בהפתעה.

</div>
