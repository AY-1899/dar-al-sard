import { writeFileSync, existsSync, readFileSync } from 'fs';

const GC_BASE = 'https://daralsard.goatcounter.com/api/v0';
const TOKEN   = process.env.GC_TOKEN;

if (!TOKEN) { console.error('GC_TOKEN not set'); process.exit(1); }

// ── Verify token ──────────────────────────────────────────────────────────────
const meRes = await fetch(`${GC_BASE}/me`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
});
if (!meRes.ok) {
    console.error(`❌ Token invalid: ${meRes.status}`);
    process.exit(1);
}
const me = await meRes.json();
console.log('✅ Token valid. Site:', me.site?.code);

// ── Fetch export (NDJSON — one JSON hit per line) ─────────────────────────────
// Find startFrom: use last saved ID to avoid re-downloading everything
let startFrom = 0;
const CACHE = 'js/analytics.json';
if (existsSync(CACHE)) {
    try {
        const prev = JSON.parse(readFileSync(CACHE, 'utf8'));
        if (prev.lastId) startFrom = prev.lastId;
    } catch {}
}

console.log(`Fetching export from ID ${startFrom}...`);
const exportRes = await fetch(`${GC_BASE}/export?startFrom=${startFrom}&limit=50000`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
});
if (!exportRes.ok) {
    const txt = await exportRes.text();
    console.error(`❌ Export failed ${exportRes.status}: ${txt.slice(0, 300)}`);
    process.exit(1);
}

const raw = await exportRes.text();
console.log(`Raw export (first 300 chars): ${raw.slice(0, 300)}`);

// ── Parse NDJSON ──────────────────────────────────────────────────────────────
const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
console.log(`Total lines: ${lines.length}`);

const hits = [];
let lastId  = startFrom;
for (const line of lines) {
    try {
        const h = JSON.parse(line);
        if (h.bot || h.event) continue;           // skip bots and events
        hits.push(h);
        if (h.id && h.id > lastId) lastId = h.id;
    } catch {}
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
    if (ua.includes('Edg/'))                              return 'Edge';
    if (ua.includes('OPR/') || ua.includes('Opera'))     return 'Opera';
    if (ua.includes('Chrome/'))                           return 'Chrome';
    if (ua.includes('Firefox/'))                          return 'Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome'))return 'Safari';
    if (ua.includes('MSIE') || ua.includes('Trident/'))  return 'Internet Explorer';
    return 'أخرى';
}

function parseOS(ua = '') {
    if (ua.includes('Android'))                           return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad'))    return 'iOS';
    if (ua.includes('Windows'))                           return 'Windows';
    if (ua.includes('Mac OS X'))                          return 'macOS';
    if (ua.includes('Linux'))                             return 'Linux';
    return 'أخرى';
}

// Iraqi governorate codes → Arabic names
const IQ_GOV = {
    'IQ-AN': 'الأنبار',    'IQ-BA': 'البصرة',      'IQ-MU': 'المثنى',
    'IQ-QA': 'القادسية',   'IQ-NA': 'النجف',        'IQ-SD': 'صلاح الدين',
    'IQ-TS': 'ذي قار',     'IQ-WA': 'واسط',         'IQ-AR': 'أربيل',
    'IQ-BB': 'بابل',       'IQ-BG': 'بغداد',        'IQ-DA': 'دهوك',
    'IQ-DI': 'ديالى',      'IQ-KA': 'كربلاء',       'IQ-KI': 'كركوك',
    'IQ-MA': 'ميسان',      'IQ-NI': 'نينوى',        'IQ-SU': 'السليمانية',
};

// Country codes → Arabic names (common ones)
const COUNTRIES = {
    'IQ':'العراق','SA':'السعودية','AE':'الإمارات','KW':'الكويت',
    'JO':'الأردن','SY':'سوريا','LB':'لبنان','EG':'مصر',
    'YE':'اليمن','OM':'عُمان','BH':'البحرين','QA':'قطر',
    'TR':'تركيا','DE':'ألمانيا','GB':'المملكة المتحدة','US':'الولايات المتحدة',
    'FR':'فرنسا','CA':'كندا','AU':'أستراليا','SE':'السويد',
    'NL':'هولندا','IT':'إيطاليا','ES':'إسبانيا','PL':'بولندا',
};

// Page path → Arabic label
const PAGE_NAMES = {
    '/': 'الرئيسية', '/index.html': 'الرئيسية',
    '/news.html': 'الأخبار', '/essays.html': 'المقالات',
};

// ── Aggregate ─────────────────────────────────────────────────────────────────
const pageMap      = {};
const countryMap   = {};
const regionMap    = {};
const browserMap   = {};
const osMap        = {};
const refMap       = {};

for (const h of recent) {
    // Pages
    const page = PAGE_NAMES[h.path] || h.path || '—';
    pageMap[page] = (pageMap[page] || 0) + 1;

    // Locations
    const loc = h.location || '';
    if (loc.startsWith('IQ-')) {
        const gov = IQ_GOV[loc] || loc;
        regionMap[gov] = (regionMap[gov] || 0) + 1;
        countryMap['العراق'] = (countryMap['العراق'] || 0) + 1;
    } else if (loc) {
        const country = COUNTRIES[loc] || loc;
        countryMap[country] = (countryMap[country] || 0) + 1;
    }

    // Browsers & OS
    const ua = h.ua || '';
    const browser = parseBrowser(ua);
    const os      = parseOS(ua);
    browserMap[browser] = (browserMap[browser] || 0) + 1;
    osMap[os]           = (osMap[os]           || 0) + 1;

    // Referrers
    const ref = h.ref || 'مباشر';
    refMap[ref] = (refMap[ref] || 0) + 1;
}

// ── Build final object ────────────────────────────────────────────────────────
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
console.log('✅ Analytics saved.');
console.log('   Pages:', analytics.hits.length, '| Countries:', analytics.locations.length,
    '| Governorates:', analytics.regions.length, '| Total hits:', analytics.totalHits);
