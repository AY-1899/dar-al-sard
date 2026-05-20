import { writeFileSync, existsSync, readFileSync } from 'fs';

const GC_BASE = 'https://daralsard.goatcounter.com/api/v0';
const TOKEN   = process.env.GC_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Accept-Encoding': 'identity',
};

if (!TOKEN) { console.error('GC_TOKEN not set'); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function gcFetch(path) {
    const r = await fetch(`${GC_BASE}${path}`, { headers: HEADERS });
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${path}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

// Fetch one stat type, with retry on 429
async function fetchStat(type, extra = '') {
    const end   = new Date();
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fmt   = d => d.toISOString().split('T')[0];
    const url   = `/stats/${type}?start=${fmt(start)}&end=${fmt(end)}&limit=20${extra}`;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const data = await gcFetch(url);
            console.log(`  ✅ ${type}: ${JSON.stringify(data).slice(0, 150)}`);
            return data;
        } catch (e) {
            if (e.message.startsWith('429') && attempt < 2) {
                console.log(`  ⏳ rate limited on ${type}, waiting 2s…`);
                await sleep(2000);
            } else {
                console.warn(`  ⚠️  ${type} failed: ${e.message}`);
                return null;
            }
        }
    }
    return null;
}

// ── Verify token ──────────────────────────────────────────────────────────────
const me = await gcFetch('/me');
console.log('✅ Token valid. User:', me.user?.email || '(ok)');

// ── Fetch stats sequentially to avoid rate limiting ───────────────────────────
const browsersData  = await fetchStat('browsers');  await sleep(600);
const systemsData   = await fetchStat('systems');   await sleep(600);
const locData       = await fetchStat('locations'); await sleep(600);
const refData       = await fetchStat('toprefs');   await sleep(600);
const langData      = await fetchStat('languages');

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

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseCountries(data) {
    if (!data) return [];
    return (data.stats || []).map(r => ({
        name:  COUNTRIES[r.id] || r.name || r.id || '—',
        count: r.count || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

function parseRegions(data) {
    if (!data) return [];
    // When filtered to IQ, GoatCounter returns subdivisions like IQ-BG
    return (data.stats || [])
        .filter(r => r.id && r.id.startsWith('IQ-'))
        .map(r => ({
            name:  IQ_GOV[r.id] || r.name || r.id,
            count: r.count || 0,
        })).sort((a,b) => b.count - a.count).slice(0, 10);
}

function parseBrowsers(data) {
    if (!data) return [];
    return (data.stats || []).map(r => ({
        name:  r.name || r.browser || 'أخرى',
        count: r.count || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

function parseSystems(data) {
    if (!data) return [];
    return (data.stats || []).map(r => ({
        name:  r.name || r.system || 'أخرى',
        count: r.count || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

function parseRefs(data) {
    if (!data) return [];
    return (data.stats || []).map(r => ({
        name:  r.name || r.ref || 'مباشر',
        count: r.count || 0,
    })).sort((a,b) => b.count - a.count).slice(0, 10);
}

// ── Build output ──────────────────────────────────────────────────────────────
const countries  = parseCountries(locData);
const regions    = parseRegions(locData);
const totalHits  = countries.reduce((s, c) => s + c.count, 0);

// Keep existing hits (top pages) from previous run if available — GoatCounter
// has no top-pages stats API endpoint; we preserve whatever was stored before.
const CACHE = 'js/analytics.json';
let prevHits = [];
if (existsSync(CACHE)) {
    try { prevHits = JSON.parse(readFileSync(CACHE,'utf8')).hits || []; } catch {}
}

// Languages
function parseLangs(data) {
    if (!data) return [];
    return (data.stats || []).map(r => ({ name: r.name || r.id || '—', count: r.count || 0 }))
        .sort((a,b) => b.count - a.count).slice(0, 8);
}

const analytics = {
    updated:   new Date().toISOString(),
    period:    {
        start: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
        end:   new Date().toISOString().split('T')[0],
    },
    totalHits,
    downloads: 0,   // GoatCounter event API not available; tracked client-side only
    hits:      prevHits,
    locations: countries,
    regions,
    browsers:  parseBrowsers(browsersData),
    systems:   parseSystems(systemsData),
    refs:      parseRefs(refData),
    languages: parseLangs(langData),
};

writeFileSync(CACHE, JSON.stringify(analytics, null, 2), 'utf8');
console.log('✅ Done.',
    '| Countries:', analytics.locations.length,
    '| Governorates:', analytics.regions.length,
    '| Browsers:', analytics.browsers.length,
    '| OS:', analytics.systems.length,
    '| Refs:', analytics.refs.length,
    '| Total hits:', analytics.totalHits);
