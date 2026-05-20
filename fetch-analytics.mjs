import { writeFileSync, existsSync, readFileSync } from 'fs';

const GC_BASE = 'https://daralsard.goatcounter.com/api/v0';
const TOKEN   = process.env.GC_TOKEN;
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

if (!TOKEN) { console.error('GC_TOKEN not set'); process.exit(1); }

async function gcFetch(method, path, body) {
    const opts = { method, headers: HEADERS };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${GC_BASE}${path}`, opts);
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${path}: ${text.slice(0, 400)}`);
    return text;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Verify token ──────────────────────────────────────────────────────────────
const meText = await gcFetch('GET', '/me');
const me = JSON.parse(meText);
console.log('✅ Token valid. Response keys:', Object.keys(me).join(', '));

// ── Find startFrom ────────────────────────────────────────────────────────────
const CACHE = 'js/analytics.json';
let startFrom = 0;
if (existsSync(CACHE)) {
    try {
        const prev = JSON.parse(readFileSync(CACHE, 'utf8'));
        if (prev.lastId) startFrom = prev.lastId;
    } catch {}
}
console.log(`Starting export from hit ID: ${startFrom}`);

// ── Start async export job ────────────────────────────────────────────────────
const jobText = await gcFetch('POST', '/export', { start_from_hit_id: startFrom });
const job = JSON.parse(jobText);
console.log(`Export job created. ID: ${job.id}`);

// ── Poll until finished ───────────────────────────────────────────────────────
let exportId = job.id;
let attempts = 0;
while (attempts < 30) {
    await sleep(3000);
    const statusText = await gcFetch('GET', `/export/${exportId}`);
    const status = JSON.parse(statusText);
    console.log(`Attempt ${attempts + 1}: finished_at=${status.finished_at}, rows=${status.num_rows}`);
    if (status.finished_at) break;
    attempts++;
}

// ── Download export ───────────────────────────────────────────────────────────
console.log('Downloading export...');
const raw = await gcFetch('GET', `/export/${exportId}/download`);
console.log(`Downloaded ${raw.length} bytes. First 300 chars: ${raw.slice(0, 300)}`);

// ── Parse NDJSON ──────────────────────────────────────────────────────────────
const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
console.log(`Total lines: ${lines.length}`);

const hits = [];
let lastId = startFrom;
for (const line of lines) {
    try {
        const h = JSON.parse(line);
        if (h.bot || h.event) continue;
        hits.push(h);
        if (h.id && h.id > lastId) lastId = h.id;
    } catch (e) {
        // skip unparseable lines
    }
}
console.log(`Valid hits: ${hits.length}`);

// ── Filter last 30 days ───────────────────────────────────────────────────────
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const recent = hits.filter(h => h.created_at && new Date(h.created_at) >= cutoff);
console.log(`Hits in last 30 days: ${recent.length}`);

// ── Helpers ───────────────────────────────────────────────────────────────────
function topN(map, n = 10) {
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, count]) => ({ name, count }));
}

function parseBrowser(ua = '') {
    if (ua.includes('Edg/'))                               return 'Edge';
    if (ua.includes('OPR/') || ua.includes('Opera'))      return 'Opera';
    if (ua.includes('Chrome/'))                            return 'Chrome';
    if (ua.includes('Firefox/'))                           return 'Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('MSIE') || ua.includes('Trident/'))   return 'Internet Explorer';
    return 'أخرى';
}

function parseOS(ua = '') {
    if (ua.includes('Android'))                            return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad'))     return 'iOS';
    if (ua.includes('Windows'))                            return 'Windows';
    if (ua.includes('Mac OS X'))                           return 'macOS';
    if (ua.includes('Linux'))                              return 'Linux';
    return 'أخرى';
}

const IQ_GOV = {
    'IQ-AN':'الأنبار', 'IQ-BA':'البصرة',  'IQ-MU':'المثنى',
    'IQ-QA':'القادسية','IQ-NA':'النجف',    'IQ-SD':'صلاح الدين',
    'IQ-TS':'ذي قار',  'IQ-WA':'واسط',    'IQ-AR':'أربيل',
    'IQ-BB':'بابل',    'IQ-BG':'بغداد',   'IQ-DA':'دهوك',
    'IQ-DI':'ديالى',   'IQ-KA':'كربلاء',  'IQ-KI':'كركوك',
    'IQ-MA':'ميسان',   'IQ-NI':'نينوى',   'IQ-SU':'السليمانية',
};

const COUNTRIES = {
    'IQ':'العراق',   'SA':'السعودية',        'AE':'الإمارات',
    'KW':'الكويت',   'JO':'الأردن',          'SY':'سوريا',
    'LB':'لبنان',    'EG':'مصر',             'YE':'اليمن',
    'OM':'عُمان',    'BH':'البحرين',         'QA':'قطر',
    'TR':'تركيا',    'DE':'ألمانيا',         'GB':'المملكة المتحدة',
    'US':'الولايات المتحدة', 'FR':'فرنسا',   'CA':'كندا',
    'AU':'أستراليا', 'SE':'السويد',          'NL':'هولندا',
    'IT':'إيطاليا',  'ES':'إسبانيا',        'PL':'بولندا',
};

const PAGE_NAMES = {
    '/':'الرئيسية', '/index.html':'الرئيسية',
    '/news.html':'الأخبار', '/essays.html':'المقالات',
};

// ── Aggregate ─────────────────────────────────────────────────────────────────
const pageMap = {}, countryMap = {}, regionMap = {},
      browserMap = {}, osMap = {}, refMap = {};

for (const h of recent) {
    const page = PAGE_NAMES[h.path] || h.path || '—';
    pageMap[page] = (pageMap[page] || 0) + 1;

    const loc = h.location || '';
    if (loc.startsWith('IQ-')) {
        const gov = IQ_GOV[loc] || loc;
        regionMap[gov]       = (regionMap[gov]       || 0) + 1;
        countryMap['العراق'] = (countryMap['العراق'] || 0) + 1;
    } else if (loc) {
        const country = COUNTRIES[loc] || loc;
        countryMap[country] = (countryMap[country] || 0) + 1;
    }

    const ua = h.ua || '';
    browserMap[parseBrowser(ua)] = (browserMap[parseBrowser(ua)] || 0) + 1;
    osMap[parseOS(ua)]           = (osMap[parseOS(ua)]           || 0) + 1;

    const ref = h.ref || 'مباشر';
    refMap[ref] = (refMap[ref] || 0) + 1;
}

// ── Save ──────────────────────────────────────────────────────────────────────
const start = cutoff.toISOString().split('T')[0];
const end   = new Date().toISOString().split('T')[0];

const analytics = {
    updated:   new Date().toISOString(),
    period:    { start, end },
    totalHits: recent.length,
    lastId,
    hits:      topN(pageMap),
    locations: topN(countryMap),
    regions:   topN(regionMap),
    browsers:  topN(browserMap),
    systems:   topN(osMap),
    refs:      topN(refMap),
};

writeFileSync(CACHE, JSON.stringify(analytics, null, 2), 'utf8');
console.log('✅ Done. Pages:', analytics.hits.length,
    '| Countries:', analytics.locations.length,
    '| Governorates:', analytics.regions.length,
    '| Total hits:', analytics.totalHits);
