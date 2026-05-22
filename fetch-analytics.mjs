import { writeFileSync, existsSync, readFileSync } from 'fs';

const GC_BASE = 'https://daralsard.goatcounter.com/api/v0';
const TOKEN   = process.env.GC_TOKEN;
const HEADERS = {
    Authorization: `Bearer ${TOKEN}`,
};

if (!TOKEN) { console.error('GC_TOKEN not set'); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Date range (module-scope so fetchStat and direct gcFetch calls share the same window)
const gcEnd   = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow — end is exclusive in GoatCounter
const gcStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const gcFmt   = d => d.toISOString().split('T')[0];

async function gcFetch(path) {
    const r = await fetch(`${GC_BASE}${path}`, { headers: HEADERS });
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${path}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

// Fetch one stat type, with retry on 429
async function fetchStat(type, extra = '', limit = 20) {
    const url   = `/stats/${type}?start=${gcFmt(gcStart)}&end=${gcFmt(gcEnd)}&limit=${limit}${extra}`;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const data = await gcFetch(url);
            console.log(`  ✅ ${type}: ${JSON.stringify(data).slice(0, 400)}`);
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
const browsersData  = await fetchStat('browsers');            await sleep(600);
const systemsData   = await fetchStat('systems');             await sleep(600);
const locData       = await fetchStat('locations', '', 100);  await sleep(600);
const refData       = await fetchStat('toprefs');             await sleep(600);
const campData      = await fetchStat('campaigns');           await sleep(600);
const langData      = await fetchStat('languages');           await sleep(600);
const hitsData      = await fetchStat('hits', '', 100);

// ── Arabic name maps ──────────────────────────────────────────────────────────
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

function normalizeRef(name) {
    if (!name || name === '—' || name === '(unknown)') return null;
    // Strip www. prefix
    name = name.replace(/^www\./, '');
    // Group all facebook variants
    if (/^facebook\.com/i.test(name) || /^m\.facebook\.com/i.test(name) || /^l\.facebook\.com/i.test(name)) return 'facebook.com';
    // Normalize Google variants
    if (/^google\./i.test(name) || name.toLowerCase() === 'google') return 'Google';
    return name;
}

function parseRefs(topData, campData) {
    const merge = {};
    for (const src of [topData, campData]) {
        (src?.stats || []).forEach(r => {
            const raw  = r.name || r.ref || '';
            const name = normalizeRef(raw);
            if (!name) return; // skip unknown/empty
            merge[name] = (merge[name] || 0) + (r.count || 0);
        });
    }
    return Object.entries(merge)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
}

// ── GoatCounter cities → Iraqi governorates ───────────────────────────────────
const CITY_TO_GOV = {
    // Standard English names
    'Baghdad':'بغداد',       'Basra':'البصرة',        'Mosul':'نينوى',
    'Erbil':'أربيل',         'Sulaymaniyah':'السليمانية', 'Kirkuk':'كركوك',
    'Fallujah':'الأنبار',    'Ramadi':'الأنبار',      'Baqubah':'ديالى',
    'Hillah':'بابل',         'Al Hillah':'بابل',      'Karbala':'كربلاء',
    'Najaf':'النجف',         'Kut':'واسط',            'Amarah':'ميسان',
    'Samawah':'المثنى',      'Nasiriyah':'ذي قار',    'Diwaniyah':'القادسية',
    'Tikrit':'صلاح الدين',   'Duhok':'دهوك',          'Babil':'بابل',
    // GoatCounter's actual city/region name variants
    'An Najaf':'النجف',      'Muhafazat Karbala\'':'كربلاء',
    'Al Basrah':'البصرة',    'Ninawa':'نينوى',        'Ninawá':'نينوى',
    'Salah ad Din':'صلاح الدين', 'Dhi Qar':'ذي قار',  'Al Muthanna':'المثنى',
    'Al Qadisiyyah':'القادسية',  'Wasit':'واسط',       'Maysan':'ميسان',
    'Al Anbar':'الأنبار',    'Diyala':'ديالى',        'Babylon':'بابل',
    'Arbil':'أربيل',         'As Sulaymaniyah':'السليمانية',
    'Dahuk':'دهوك',          'At Ta\'mim':'كركوك',
};

async function fetchCityRegions() {
    try {
        const data = await gcFetch(`/stats/cities?start=${gcFmt(gcStart)}&end=${gcFmt(gcEnd)}&limit=100`);
        const govMap = {};
        for (const r of (data?.stats || [])) {
            const gov = CITY_TO_GOV[r.name];
            if (gov) govMap[gov] = (govMap[gov] || 0) + (r.count || 0);
        }
        const rows = Object.entries(govMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        console.log(`  ✅ City→Gov regions: ${rows.length} governorates`);
        return rows;
    } catch (e) {
        console.warn('  ⚠️  City regions failed:', e.message);
        return [];
    }
}

// ── Build output ──────────────────────────────────────────────────────────────
const countries = parseCountries(locData);
const totalHits = countries.reduce((s, c) => s + c.count, 0);

// Keep existing history from previous run
const CACHE = 'js/analytics.json';
let prevHits = [], monthly = [], prevRegions = [], prevDaily = [];
if (existsSync(CACHE)) {
    try {
        const prev = JSON.parse(readFileSync(CACHE,'utf8'));
        prevHits    = prev.hits    || [];
        monthly     = prev.monthly || [];
        prevRegions = prev.regions || [];
        prevDaily   = prev.daily   || [];
    } catch {}
}

// GoatCounter cities → governorates. Fall back to previous data if fetch fails.
const cityRegions = await fetchCityRegions();
const regions     = cityRegions.length ? cityRegions : prevRegions;

// ── Accumulate monthly history ────────────────────────────────────────────────
const now      = new Date();
const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
const prevMon  = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-based
const prevKey  = `${prevYear}-${String(prevMon).padStart(2,'0')}`;

if (!monthly.find(m => m.month === prevKey)) {
    const mStart = `${prevYear}-${String(prevMon).padStart(2,'0')}-01`;
    const mEnd   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    try {
        const mLoc  = await gcFetch(`/stats/locations?start=${mStart}&end=${mEnd}&limit=50`);
        const mHits = (mLoc?.stats || []).reduce((s,r) => s + (r.count||0), 0);
        if (mHits > 0) {
            monthly.push({ month: prevKey, hits: mHits });
            monthly.sort((a,b) => a.month.localeCompare(b.month));
            console.log(`  📅 Added month ${prevKey}: ${mHits} hits`);
        }
    } catch (e) {
        console.warn(`  ⚠️  Could not fetch monthly data for ${prevKey}:`, e.message);
    }
}

// ── Accumulate daily history (last 90 days) ───────────────────────────────────
const today    = gcFmt(new Date());
const day90Ago = gcFmt(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

let daily = prevDaily.filter(d => d.date >= day90Ago);

const existingDays = new Set(daily.map(d => d.date));
const toFetch = [];
for (let i = 29; i >= 1; i--) {
    const d = gcFmt(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    if (!existingDays.has(d)) toFetch.push(d);
}

for (const date of toFetch) {
    const nextDay = gcFmt(new Date(new Date(date + 'T00:00:00Z').getTime() + 24 * 60 * 60 * 1000));
    try {
        const d    = await gcFetch(`/stats/locations?start=${date}&end=${nextDay}&limit=100`);
        const hits = (d?.stats || []).reduce((s, r) => s + (r.count || 0), 0);
        daily.push({ date, hits });
        console.log(`  📅 ${date}: ${hits} hits`);
        await sleep(400);
    } catch (e) {
        console.warn(`  ⚠️  Daily fetch failed for ${date}:`, e.message);
    }
}
daily.sort((a, b) => a.date.localeCompare(b.date));
console.log(`  📅 Daily entries total: ${daily.length}`);

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
    downloads: (hitsData?.hits || []).find(h => h.path === 'pdf-download' || h.path === '/pdf-download')?.count || 0,
    hits:      prevHits,
    locations: countries,
    regions,
    browsers:  parseBrowsers(browsersData),
    systems:   parseSystems(systemsData),
    refs:      parseRefs(refData, campData),
    languages: parseLangs(langData),
    monthly,
    daily,
};

writeFileSync(CACHE, JSON.stringify(analytics, null, 2), 'utf8');
console.log('✅ Done.',
    '| Countries:', analytics.locations.length,
    '| Governorates:', analytics.regions.length,
    '| Browsers:', analytics.browsers.length,
    '| OS:', analytics.systems.length,
    '| Refs:', analytics.refs.length,
    '| Total hits:', analytics.totalHits);
