import os, sys, re, shutil
sys.stdout.reconfigure(encoding='utf-8')

ASSETS = "assets"

# ── 1. DELETE orphans and duplicates ─────────────────────────────────────────
to_delete = [
    # duplicate of CRITICAL READINGS.pdf (same book, Arabic title version)
    os.path.join(ASSETS, "قراءات نقدية في روايات عالمية.pdf"),
    # duplicate of رواية الهاتف الأخير تدقيق نهائي.pdf (keep the final version)
    os.path.join(ASSETS, "رواية الهاتف الأخير.pdf"),
    # no matching book
    os.path.join(ASSETS, "كتاب النقد الثاني  .pdf"),
    # no matching book
    "الاغتراب السياسي.pdf",
    # no matching book (scan artifact filename)
    "الرجل الذي صار حرفاً_20251116_092703_0000.pdf",
]

print("── Deleting orphans / duplicates ──")
for p in to_delete:
    if os.path.exists(p):
        os.remove(p)
        print(f"  DELETED: {p}")
    else:
        print(f"  NOT FOUND (already gone?): {p}")

# ── 2. MOVE root PDFs into assets/ and normalise names ───────────────────────
# (old_path, new_filename_in_assets)
moves = [
    ("التجربة البشرية.pdf",                   "التجربة البشرية.pdf"),
    ("الحلم والمسافة.pdf",                    "الحلم والمسافة.pdf"),
    ("الحياة قصيرة.pdf",                      "الحياة قصيرة.pdf"),
    ("الرئيس مسعود البارزاني.pdf",            "الرئيس مسعود البارزاني والرؤية الاستراتيجية.pdf"),
    ("المنعطف.pdf",                            "المنعطف 2.pdf"),
    ("حين يصمتُ التمثال.pdf",                 "حين يصمت التمثال.pdf"),
    ("ذاكرة الخراب.pdf",                       "ذاكرة الخراب.pdf"),
    ("رواياتي بعيون من كتبوا عنها.pdf",       "رواياتي بعيون من كتبوا عنها.pdf"),
    ("شظايا  ناعمة.pdf",                       "شظايا ناعمة.pdf"),
    ("قالت لي الصحراء.pdf",                   "قالت لي الصحراء.pdf"),
    ("ليس لي.pdf",                             "ليس لي.pdf"),
    ("منهجيّة تحقيق النّصوص.pdf",             "منهجية تحقيق النصوص.pdf"),
]

print("\n── Moving root PDFs → assets/ ──")
for src, dst_name in moves:
    dst = os.path.join(ASSETS, dst_name)
    if os.path.exists(src):
        if os.path.exists(dst):
            os.remove(src)
            print(f"  SKIP (target exists, removed src): {src}")
        else:
            shutil.move(src, dst)
            print(f"  MOVED: {src} → assets/{dst_name}")
    else:
        print(f"  NOT FOUND: {src}")

# ── 3. RENAME files already in assets/ to clean names ────────────────────────
renames = [
    ("زهورُ الدِّمن-2.pdf",                          "زهور الدمن.pdf"),
    ("رواية الهاتف الأخير تدقيق نهائي.pdf",          "الهاتف الأخير.pdf"),
    ("ديوان اوتار الرسالة.pdf",                       "أوتار الرسالة.pdf"),
    ("أساليب_الخطاب_الشعري_كامل_مع_الملخص.pdf",     "أساليب الخطاب الشعري.pdf"),
    ("عباس لطيف.pdf",                                 "رؤى نقدية في تجربة عباس لطيف الروائية.pdf"),
    ("قلق الحقيقة وصنميّة الثوابت.pdf",              "قلق الحقيقة وصنمية بعض الثوابت.pdf"),
    ("هوامش في دفتر الغربة .pdf",                     "هوامش في دفتر الغربة.pdf"),
]

print("\n── Renaming in assets/ ──")
for old, new in renames:
    src = os.path.join(ASSETS, old)
    dst = os.path.join(ASSETS, new)
    if os.path.exists(src):
        if os.path.exists(dst):
            print(f"  SKIP (target exists): {new}")
        else:
            os.rename(src, dst)
            print(f"  RENAMED: {old} → {new}")
    else:
        print(f"  NOT FOUND: {old}")

# ── 4. UPDATE data.js pdf fields ─────────────────────────────────────────────
# Map: book id → pdf filename in assets/
pdf_map = {
    1:  "assets/زهور الدمن.pdf",
    2:  "assets/CRITICAL READINGS.pdf",
    3:  "assets/قصاصات.pdf",
    4:  "assets/الحمائم البيض.pdf",
    5:  "assets/كشكول الربيعي.pdf",
    6:  "assets/حلم مسافر.pdf",
    7:  "assets/عاشقات الحمام وعشاقهن.pdf",
    8:  "assets/نديمات جلنار.pdf",
    9:  "assets/قلق الحقيقة وصنمية بعض الثوابت.pdf",
    10: "assets/منهجية البحث العلمي.pdf",
    12: "assets/الهاتف الأخير.pdf",
    13: "assets/أوتار الرسالة.pdf",
    15: "assets/شجرة الأيادي.pdf",
    17: "assets/أساليب الخطاب الشعري.pdf",
    19: "assets/الطريق إلى سورتينو.pdf",
    20: "assets/الضوء والطين.pdf",
    21: "assets/قتل الأفذاذ.pdf",
    22: "assets/عرضحال بغدادي.pdf",
    23: "assets/أفنان الرؤى.pdf",
    24: "assets/رؤى نقدية في تجربة عباس لطيف الروائية.pdf",
    25: "assets/هوامش في دفتر الغربة.pdf",
    26: "assets/حين يصمت التمثال.pdf",
    27: "assets/رواياتي بعيون من كتبوا عنها.pdf",
    28: "assets/قالت لي الصحراء.pdf",
    29: "assets/شظايا ناعمة.pdf",
    30: "assets/الرئيس مسعود البارزاني والرؤية الاستراتيجية.pdf",
    31: "assets/منهجية تحقيق النصوص.pdf",
    32: "assets/ليس لي.pdf",
    33: "assets/المنعطف 2.pdf",
    34: "assets/الحياة قصيرة.pdf",
    35: "assets/ذاكرة الخراب.pdf",
    36: "assets/الحلم والمسافة.pdf",
    37: "assets/التجربة البشرية.pdf",
}

print("\n── Updating data.js ──")
with open("js/data.js", encoding="utf-8") as f:
    content = f.read()

# Parse each book block and update the pdf field
def update_pdf(content, book_id, pdf_path):
    # Find the block for this id and replace its pdf: "" with the path
    pattern = rf'(id: {book_id},.*?pdf: )"[^"]*"'
    replacement = rf'\1"{pdf_path}"'
    new_content, n = re.subn(pattern, replacement, content, flags=re.DOTALL)
    return new_content, n

for book_id, pdf_path in sorted(pdf_map.items()):
    content, n = update_pdf(content, book_id, pdf_path)
    status = "OK" if n else "NOT MATCHED"
    print(f"  Book {book_id:2d}: [{status}] {pdf_path}")

with open("js/data.js", "w", encoding="utf-8") as f:
    f.write(content)

print("\nDone!")
