#!/bin/bash
# בונה חבילת ZIP מוכנה להעלאה לחנות התוספים של כרום.
# מכניס רק את קבצי התוסף עצמו — לא תיעוד, לא נכסי חנות.
set -e
cd "$(dirname "$0")"

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/[^0-9.]//g')
OUT="emet-v${VERSION}.zip"

rm -f "$OUT"
zip -r "$OUT" \
  manifest.json \
  assets \
  src \
  -x '*.DS_Store' \
  > /dev/null

echo "✓ נוצר $OUT ($(du -h "$OUT" | cut -f1))"
echo "  קבצים בחבילה:"
unzip -l "$OUT" | awk 'NR>3 && $4 {print "   " $4}' | grep -v '^   $' | head -30
