import os
import shutil
import re
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

ASSETS = r"D:\Dar Al Sard\assets"
DATA_JS = r"D:\Dar Al Sard\js\data.js"

# Mapping: old filename → new filename (without extension)
rename_map = {
    "photo_2026-04-30_13-54-34.jpg": "زهور الدمن - ضاري الغضبان.jpg",
    "photo_2026-04-30_13-54-43.jpg": "CRITICAL READINGS IN GLOBAL DYSTOPIAN POLITICAL NOVELS - DR. SALIM KADHIM ABBAS.jpg",
    "photo_2026-04-30_13-54-49.jpg": "قصاصات - فرات أحمد.jpg",
    "photo_2026-04-30_13-54-53.jpg": "الحمائم البيض - إسماعيل سكران.jpg",
    "photo_2026-04-30_13-54-59.jpg": "كشكول الربيعي - عبد الرزاق الربيعي.jpg",
    "photo_2026-04-30_13-55-04.jpg": "حلم مسافر - كريم حميد البدري.jpg",
    "photo_2026-04-30_13-55-08.jpg": "عاشقات الحمام وعشاقهن - رجاء الجابري.jpg",
    "photo_2026-04-30_13-55-12.jpg": "نديمات جلنار - إسماعيل ابراهيم عبد.jpg",
    "photo_2026-04-30_13-55-15.jpg": "_duplicate_عاشقات الحمام.jpg",  # duplicate
    "photo_2026-04-30_13-55-19.jpg": "قلق الحقيقة وصنمية بعض الثوابت - صالح الطائي.jpg",
    "photo_2026-04-30_13-55-23.jpg": "منهجية البحث العلمي المعاصر في الدراسات الإسلامية - رياض ناجي.jpg",
    "photo_2026-04-30_13-55-28.jpg": "التشيع والغلو - جميل الربيعي.jpg",
    "photo_2026-04-30_13-55-36.jpg": "الهاتف الأخير - رافد حميد القاضي.jpg",
    "photo_2026-04-30_13-55-40.jpg": "أوتار الرسالة - رافد حميد القاضي.jpg",
    "photo_2026-04-30_13-55-44.jpg": "منبر الضاد سجل المداد الطلابي.jpg",
    "photo_2026-04-30_13-55-49.jpg": "_duplicate_قلق الحقيقة.jpg",  # duplicate
    "photo_2026-04-30_13-55-53.jpg": "شجرة الأيادي - علي قاسم.jpg",
    "photo_2026-04-30_13-55-56.jpg": "دراسات في علم اللغة المعاصر - بلال نجم.jpg",
    "photo_2026-04-30_13-56-00.jpg": "أساليب الخطاب الشعري في شعر رشيد سليم الخوري - أريج المدلل.jpg",
    "photo_2026-04-30_13-56-06.jpg": "الصاعدون إلى الخلود - صالح الطائي.jpg",
    "photo_2026-04-30_13-56-10.jpg": "الطريق إلى سورتينو - حميد نعمة عبد.jpg",
    "photo_2026-04-30_13-56-14.jpg": "الضوء والطين - مالك كاظم عطية.jpg",
    "photo_2026-04-30_13-56-23.jpg": "قتل الأفذاذ - صالح الطائي.jpg",
    "photo_2026-04-30_13-56-54.jpg": "عرضحال بغدادي - خضير فليح الزيدي.jpg",
    "photo_2026-04-30_13-56-58.jpg": "أفنان الرؤى - ربا الرباعي.jpg",
    "photo_2026-04-30_13-57-01.jpg": "رؤى نقدية في تجربة عباس لطيف الروائية - سمير الخليل.jpg",
    "photo_2026-04-30_13-57-05.jpg": "هوامش في دفتر الغربة - علي طعمة.jpg",
    "photo_2026-04-30_13-57-09.jpg": "حين يصمت التمثال - أمير الحلاج.jpg",
    "photo_2026-04-30_13-57-13.jpg": "رواياتي بعيون من كتبوا عنها - راسم الحديثي.jpg",
    "photo_2026-04-30_13-57-18.jpg": "قالت لي الصحراء - عبد الوهاب الحربي.jpg",
    "photo_2026-04-30_13-57-22.jpg": "شظايا ناعمة - اعتماد الفراتي.jpg",
    "photo_2026-04-30_13-57-26.jpg": "الرئيس مسعود البارزاني والرؤية الاستراتيجية - المندلاوي.jpg",
    "photo_2026-04-30_13-57-34.jpg": "منهجية تحقيق النصوص - علاء المندلاوي.jpg",
    "photo_2026-04-30_13-57-38.jpg": "ليس لي - عادل فارس.jpg",
    "photo_2026-04-30_13-57-42.jpg": "المنعطف 2 - حامد العطار.jpg",
    "photo_2026-04-30_13-57-46.jpg": "الحياة قصيرة اصنع كل يوم فارقاً - إياد الكبيسي.jpg",
    "photo_2026-04-30_13-57-49.jpg": "_duplicate_ذاكرة الخراب.jpg",  # duplicate
    "photo_2026-04-30_13-57-53.jpg": "ذاكرة الخراب قصص قصيرة - أحمد السلمان.jpg",
    "photo_2026-04-30_13-57-56.jpg": "الحلم والمسافة - عبد الزهرة خضير.jpg",
    "photo_2026-04-30_13-58-00.jpg": "التجربة البشرية - صالح الطائي.jpg",
}

# Rename files
print("Renaming files...")
for old, new in rename_map.items():
    old_path = os.path.join(ASSETS, old)
    new_path = os.path.join(ASSETS, new)
    if os.path.exists(old_path):
        if os.path.exists(new_path):
            print(f"  SKIP (target exists): {old} -> {new}")
        else:
            os.rename(old_path, new_path)
            print(f"  OK: {old} -> {new}")
    else:
        print(f"  NOT FOUND: {old}")

# Update data.js
print("\nUpdating data.js...")
with open(DATA_JS, 'r', encoding='utf-8') as f:
    content = f.read()

for old, new in rename_map.items():
    if not new.startswith("_duplicate_"):
        old_ref = f'assets/{old}'
        new_ref = f'assets/{new}'
        if old_ref in content:
            content = content.replace(old_ref, new_ref)
            print(f"  Updated ref: {old} -> {new}")

with open(DATA_JS, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
