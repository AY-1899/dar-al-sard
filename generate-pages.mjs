import { readFileSync, writeFileSync } from 'fs';

const BASE = 'https://daralsard.com';

function esc(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function parseData(js, varName) {
    const match = js.match(new RegExp(`const\\s+${varName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
    if (!match) throw new Error(`Could not parse ${varName}`);
    return eval(match[1]); // eslint-disable-line no-eval
}

// ── Essays ────────────────────────────────────────────────────────────────────
const essaysJs = readFileSync('js/essays.js', 'utf8');
const essays   = parseData(essaysJs, 'essaysData');

for (const e of essays) {
    const ogImage = e.image
        ? (e.image.startsWith('http') ? e.image : `${BASE}/${e.image}`)
        : `${BASE}/assets/logo.png`;
    const desc = esc((e.abstract || e.title || '').substring(0, 200));

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${esc(e.title)} | دار السرد</title>
    <link rel="canonical" href="${BASE}/essay.html?id=${e.id}">
    <meta property="og:type"        content="article">
    <meta property="og:site_name"   content="دار السرد">
    <meta property="og:url"         content="${BASE}/essay-${e.id}.html">
    <meta property="og:title"       content="${esc(e.title)} | دار السرد">
    <meta property="og:description" content="${desc}">
    <meta property="og:image"       content="${ogImage}">
    <meta property="og:locale"      content="ar_IQ">
    <meta name="twitter:card"       content="summary_large_image">
    <meta name="twitter:image"      content="${ogImage}">
    <meta name="twitter:title"      content="${esc(e.title)} | دار السرد">
    <meta name="twitter:description" content="${desc}">
    <meta http-equiv="refresh"      content="0;url=essay.html?id=${e.id}">
</head>
<body>
    <script>location.replace('essay.html?id=${e.id}');</script>
</body>
</html>`;

    writeFileSync(`essay-${e.id}.html`, html, 'utf8');
    console.log(`  ✅ essay-${e.id}.html — ${e.title}`);
}

// ── News ─────────────────────────────────────────────────────────────────────
const newsJs = readFileSync('js/news.js', 'utf8');
const news   = parseData(newsJs, 'newsData');

for (const n of news) {
    const imgs   = Array.isArray(n.images) ? n.images : (n.image ? [n.image] : []);
    const rawImg = imgs[0] || '';
    const ogImage = rawImg
        ? (rawImg.startsWith('http') ? rawImg : `${BASE}/${rawImg}`)
        : `${BASE}/assets/logo.png`;
    const desc = esc((n.body || n.title || '').substring(0, 200));

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${esc(n.title)} | دار السرد</title>
    <link rel="canonical" href="${BASE}/news-article.html?id=${n.id}">
    <meta property="og:type"        content="article">
    <meta property="og:site_name"   content="دار السرد">
    <meta property="og:url"         content="${BASE}/news-${n.id}.html">
    <meta property="og:title"       content="${esc(n.title)} | دار السرد">
    <meta property="og:description" content="${desc}">
    <meta property="og:image"       content="${ogImage}">
    <meta property="og:locale"      content="ar_IQ">
    <meta name="twitter:card"       content="summary_large_image">
    <meta name="twitter:image"      content="${ogImage}">
    <meta name="twitter:title"      content="${esc(n.title)} | دار السرد">
    <meta name="twitter:description" content="${desc}">
    <meta http-equiv="refresh"      content="0;url=news-article.html?id=${n.id}">
</head>
<body>
    <script>location.replace('news-article.html?id=${n.id}');</script>
</body>
</html>`;

    writeFileSync(`news-${n.id}.html`, html, 'utf8');
    console.log(`  ✅ news-${n.id}.html — ${n.title}`);
}

console.log(`\n✅ Done. ${essays.length} essay pages + ${news.length} news pages generated.`);
