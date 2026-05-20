import { writeFileSync } from 'fs';

const GC_BASE = 'https://daralsard.goatcounter.com/api/v0';
const TOKEN   = process.env.GC_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Accept-Encoding': 'identity',
};

if (!TOKEN) { console.error('GC_TOKEN not set'); process.exit(1); }

async function gcFetch(path) {
    const r = await fetch(`${GC_BASE}${path}`, { headers: HEADERS });
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${path}: ${text.slice(0, 400)}`);
    return JSON.parse(text);
}

// ── Verify token ──────────────────────────────────────────────────────────────
const me = await gcFetch('/me');
console.log('✅ Token valid. User:', me.user?.email || '(ok)');

// ── Date range: last 30 days ──────────────────────────────────────────────────
const end   = new Date();
const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const fmt   = d => d.toISOString().split('T')[0];
const range = `start=${fmt(start)}&end=${fmt(end)}`;
console.log(`Fetching stats for ${fmt(start)} → ${fmt(end)}`);

// ── Fetch each stats endpoint ─────────────────────────────────────────────────
async function fetchStat(name, qs = range) {
    try {
        const data = await gcFetch(`/stats/${name}?${qs}&limit=20`);
        console.log(`  ${name}: ${JSON.stringify(data).slice(0, 120)}`);
        return data;
    } catch (e) {
        console.warn(`  ⚠️  ${name} failed: ${e.message}`);
        return null;
    }
}

const [hitsData, browsersData, systemsData, locData, refData] = await Promise.all([
    fetchStat('hits'),
    fetchStat('browsers'),
    fetchStat('systems'),
    fetchStat('locations'),
    fetchStat('refs'),
]);

// ── Arabic name maps ──────────────────────────────────────────────────────────
const IQ_GOV = {
    'IQ-AN':'الأنبار','IQ-BA':'البصرة', 'IQ-MU':'المثنى',
    'IQ-QA':'القادسية','IQ-NA':'النجف', 'IQ-SD':'صلاح الدين',
    'IQ-TS':'ذي قار', 'IQ-WA':'واسط',  'IQ-AR':'أربيل',
    'IQ-BB':'بابل',   'IQ-BG':'بغداد', 'IQ-DA':'دهوك',
    'IQ-DI':'ديالى',  'IQ-KA':'كربلاء','IQ-KI':'كركوك',
    'IQ-MA':'ميسان',  'IQ-NI':'نينوى', 'IQ-SU':'السليمانية',
};
const COUNTRIES = {
    'IQ':'العراق',   'SA':'السعودية',  'AE':'الإمارات',
    'KW':'الكويت',   'JO':'الأردن',    'SY':'سوريا',
    'LB':'لبنان',    'EG':'مصر',       'YE':'اليمن',
    'OM':'عُمان',    'BH':'البحرين',   'QA':'قطر',
    'TR':'تركيا',    'DE':'ألمانيا',   'GB':'المملكة المتحدة',
    'US':'الولايات المتحدة','FR':'فرنسا','CA':'كندا',
    'AU':'أستراليا', 'SE':'السويد',    'NL':'هولندا',
    'IT':'إيطاليا',  'ES':'إسبانيا',  'PL':'بولندا',
};
const PAGE_NAMES = {
    '/':'الرئيسية', '/index.html':'الرئيسية',
    '/news.html':'الأخبار', '/essays.html':'المقالات',
};
const BROWSER_AR = {
    'Chrome':'Chrome','Firefox':'Firefox','Safari':'Safari',
    'Edge':'Edge','Opera':'Opera','Samsung Internet':'Samsung Internet',
};
const OS_AR = {
    'Windows':'Windows','Android':'Android','iOS':'iOS',
    'macOS':'macOS','Linux':'Linux',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function topN(arr, n = 10) {
    return (arr || []).slice(0, n);
}

// GoatCounter stats/hits returns { hits: [ {path, title, count, count_unique} ] }
function parseHits(data) {
    if (!data) return [];
    const rows = data.hits || data.pages || [];
    return rows.map(r => ({
        name:  PAGE_NAMES[r.path] || r.path || r.name || '—',
        count: r.count || r.count_unique || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

// GoatCounter stats/browsers returns { browsers: [ {browser, count} ] }
function parseBrowsers(data) {
    if (!data) return [];
    const rows = data.browsers || data.stats || [];
    return rows.map(r => ({
        name:  BROWSER_AR[r.browser || r.name] || r.browser || r.name || 'أخرى',
        count: r.count || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

function parseSystems(data) {
    if (!data) return [];
    const rows = data.systems || data.stats || [];
    return rows.map(r => ({
        name:  OS_AR[r.system || r.os || r.name] || r.system || r.os || r.name || 'أخرى',
        count: r.count || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

function parseLocations(data) {
    if (!data) return { countries: [], regions: [] };
    const rows = data.locations || data.stats || [];
    const countries = [], regions = [];
    for (const r of rows) {
        const loc   = r.location || r.id || r.name || '';
        const count = r.count || 0;
        if (loc.startsWith('IQ-')) {
            regions.push({ name: IQ_GOV[loc] || loc, count });
            // aggregate Iraq total in countries
            const existing = countries.find(c => c.name === 'العراق');
            if (existing) existing.count += count;
            else countries.push({ name: 'العراق', count });
        } else {
            countries.push({ name: COUNTRIES[loc] || loc, count });
        }
    }
    return {
        countries: countries.sort((a,b) => b.count - a.count).slice(0,10),
        regions:   regions.sort((a,b) => b.count - a.count).slice(0,10),
    };
}

function parseRefs(data) {
    if (!data) return [];
    const rows = data.refs || data.stats || [];
    return rows.map(r => ({
        name:  r.ref || r.name || 'مباشر',
        count: r.count || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

// ── Build output ──────────────────────────────────────────────────────────────
const { countries, regions } = parseLocations(locData);
const totalHits = (hitsData?.hits || []).reduce((s, r) => s + (r.count || 0), 0);

const analytics = {
    updated:   new Date().toISOString(),
    period:    { start: fmt(start), end: fmt(end) },
    totalHits,
    hits:      parseHits(hitsData),
    locations: countries,
    regions,
    browsers:  parseBrowsers(browsersData),
    systems:   parseSystems(systemsData),
    refs:      parseRefs(refData),
};

const CACHE = 'js/analytics.json';
writeFileSync(CACHE, JSON.stringify(analytics, null, 2), 'utf8');
console.log('✅ Done. Pages:', analytics.hits.length,
    '| Countries:', analytics.locations.length,
    '| Governorates:', analytics.regions.length,
    '| Total hits:', analytics.totalHits);
