#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-store-images.py — ממיר צילומי מסך גולמיים לנכסים בגודל המדויק
שחנות התוספים של כרום דורשת.

התקנה:   pip3 install pillow
שימוש:   python3 make-store-images.py raw/*.png
          python3 make-store-images.py --mode crop raw/hero.png
          python3 make-store-images.py --bg "#0d1117" raw/*.png

הפלט נשמר ב-out/ בשמות screenshot-1.png ... screenshot-5.png,
כל אחד בדיוק 1280x800 פיקסלים, RGB, בלי ערוץ אלפא.

מצבים:
  contain (ברירת מחדל) — מקטין את התמונה כך שתיכנס במלואה, וממלא את השוליים.
                          שום דבר לא נחתך. מתאים לפאנל צר וגבוה.
  crop                  — ממלא את כל הקנבס וחותך את העודף מהמרכז.
                          מתאים לצילום מסך רחב שכבר קרוב ל-16:10.
"""

import argparse, os, sys
from PIL import Image, ImageFilter

W, H = 1280, 800
PROMO_W, PROMO_H = 440, 280


def edge_color(im):
    """צבע רקע שנדגם מפינות התמונה — מתמזג טוב יותר מאשר שחור שרירותי."""
    small = im.convert("RGB").resize((32, 32))
    px = small.load()
    corners = [px[1, 1], px[30, 1], px[1, 30], px[30, 30]]
    r = sum(c[0] for c in corners) // 4
    g = sum(c[1] for c in corners) // 4
    b = sum(c[2] for c in corners) // 4
    return (r, g, b)


def blurred_backdrop(im, w, h):
    """רקע מטושטש מהתמונה עצמה — נראה הרבה יותר טוב משטח אחיד
    כשהתמונה צרה בהרבה מהקנבס."""
    src = im.convert("RGB")
    ratio = max(w / src.width, h / src.height)
    bg = src.resize((int(src.width * ratio) + 1, int(src.height * ratio) + 1), Image.LANCZOS)
    left = (bg.width - w) // 2
    top = (bg.height - h) // 2
    bg = bg.crop((left, top, left + w, top + h))
    bg = bg.filter(ImageFilter.GaussianBlur(28))
    # מכהה את הרקע כדי שהתמונה החדה תבלוט
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.blend(bg, dark, 0.55)


def fit(im, w, h, mode="contain", bg=None, backdrop="blur", margin=0):
    src = im.convert("RGB")

    if mode == "crop":
        ratio = max(w / src.width, h / src.height)
        nw, nh = int(src.width * ratio + 0.5), int(src.height * ratio + 0.5)
        resized = src.resize((nw, nh), Image.LANCZOS)
        left, top = (nw - w) // 2, (nh - h) // 2
        return resized.crop((left, top, left + w, top + h))

    # contain
    avail_w, avail_h = w - 2 * margin, h - 2 * margin
    ratio = min(avail_w / src.width, avail_h / src.height)
    nw, nh = max(1, int(src.width * ratio)), max(1, int(src.height * ratio))
    resized = src.resize((nw, nh), Image.LANCZOS)

    if bg:
        canvas = Image.new("RGB", (w, h), bg)
    elif backdrop == "blur":
        canvas = blurred_backdrop(src, w, h)
    else:
        canvas = Image.new("RGB", (w, h), edge_color(src))

    canvas.paste(resized, ((w - nw) // 2, (h - nh) // 2))
    return canvas


def main():
    p = argparse.ArgumentParser()
    p.add_argument("files", nargs="+", help="צילומי מסך גולמיים, בסדר שבו הם יופיעו בחנות")
    p.add_argument("--mode", choices=["contain", "crop"], default="contain")
    p.add_argument("--bg", default=None, help='צבע רקע אחיד, למשל "#0d1117". ברירת המחדל: רקע מטושטש מהתמונה')
    p.add_argument("--backdrop", choices=["blur", "flat"], default="blur")
    p.add_argument("--margin", type=int, default=0, help="שוליים בפיקסלים סביב התמונה")
    p.add_argument("--out", default="out")
    p.add_argument("--promo", action="store_true", help="לייצר גם תמונת קידום 440x280 מהקובץ הראשון")
    a = p.parse_args()

    if len(a.files) > 5:
        print(f"⚠  החנות מקבלת עד 5 צילומי מסך. נלקחים חמשת הראשונים מתוך {len(a.files)}.", file=sys.stderr)
        a.files = a.files[:5]

    os.makedirs(a.out, exist_ok=True)

    for i, path in enumerate(a.files, 1):
        try:
            im = Image.open(path)
        except Exception as e:
            print(f"✗  {path}: {e}", file=sys.stderr)
            continue

        out_im = fit(im, W, H, mode=a.mode, bg=a.bg, backdrop=a.backdrop, margin=a.margin)
        dest = os.path.join(a.out, f"screenshot-{i}.png")
        out_im.save(dest, "PNG", optimize=True)
        print(f"✓  {os.path.basename(path)}  {im.width}x{im.height}  →  {dest}  {W}x{H}")

        if a.promo and i == 1:
            promo = fit(im, PROMO_W, PROMO_H, mode="crop")
            pdest = os.path.join(a.out, "promo-440x280.png")
            promo.save(pdest, "PNG", optimize=True)
            print(f"✓  תמונת קידום קטנה  →  {pdest}  {PROMO_W}x{PROMO_H}")

    print(f"\nמוכן. העלה את הקבצים מתוך {a.out}/ בלשונית Store listing.")


if __name__ == "__main__":
    main()
