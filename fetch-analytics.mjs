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
    const end   = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow — end is exclusive in GoatCounter
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fmt   = d => d.toISOString().split('T')[0];
    const url   = `/stats/${type}?start=${fmt(start)}&end=${fmt(end)}&limit=20${extra}`;
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
const locData       = await fetchStat('locations');           await sleep(600);
const locIqData     = await fetchStat('locations', '&country=IQ');        await sleep(600);
const refData       = await fetchStat('toprefs');             await sleep(600);
const campData      = await fetchStat('campaigns');           await sleep(600);
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

// ── GA4: fetch Iraqi governorate data ────────────────────────────────────────
const GA4_CLIENT_ID     = process.env.GA4_CLIENT_ID;
const GA4_CLIENT_SECRET = process.env.GA4_CLIENT_SECRET;
const GA4_REFRESH_TOKEN = process.env.GA4_REFRESH_TOKEN;
const GA4_PROPERTY_ID   = process.env.GA4_PROPERTY_ID;

const GOV_AR = {
    'Baghdad':'بغداد',         'Basra':'البصرة',          'Nineveh':'نينوى',
    'Erbil':'أربيل',           'Sulaymaniyah':'السليمانية','Kirkuk':'كركوك',
    'Anbar':'الأنبار',         'Diyala':'ديالى',           'Babylon':'بابل',
    'Karbala':'كربلاء',        'Najaf':'النجف',            'Wasit':'واسط',
    'Maysan':'ميسان',          'Muthanna':'المثنى',        'Dhi Qar':'ذي قار',
    'Qadisiyyah':'القادسية',   'Saladin':'صلاح الدين',     'Duhok':'دهوك',
    'Al Anbar':'الأنبار',      'Dhī Qār':'ذي قار',
};

async function fetchGA4Regions() {
    if (!GA4_CLIENT_ID || !GA4_CLIENT_SECRET || !GA4_REFRESH_TOKEN || !GA4_PROPERTY_ID) {
        console.log('  ℹ️  GA4 secrets not set — skipping governorate fetch');
        return [];
    }
    try {
        // Exchange refresh token for access token
        const tokRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id:     GA4_CLIENT_ID,
                client_secret: GA4_CLIENT_SECRET,
                refresh_token: GA4_REFRESH_TOKEN,
                grant_type:    'refresh_token',
            }),
        });
        const { access_token } = await tokRes.json();
        if (!access_token) throw new Error('No access token returned');

        // Query GA4 Data API for regions within Iraq
        const body = {
            dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
            dimensions: [{ name: 'region' }],
            metrics:    [{ name: 'sessions' }],
            dimensionFilter: {
                filter: {
                    fieldName: 'country',
                    stringFilter: { matchType: 'EXACT', value: 'Iraq' },
                },
            },
            limit: 20,
        };
        const repRes = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
            {
                method: 'POST',
                headers: {
                    Authorization:  `Bearer ${access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );
        const report = await repRes.json();
        if (!repRes.ok) throw new Error(JSON.stringify(report).slice(0, 200));

        const rows = (report.rows || []).map(row => {
            const raw   = row.dimensionValues?.[0]?.value || '';
            const name  = GOV_AR[raw] || raw;
            const count = parseInt(row.metricValues?.[0]?.value || '0', 10);
            return { name, count };
        }).filter(r => r.count > 0).sort((a,b) => b.count - a.count);

        console.log(`  ✅ GA4 regions: ${rows.length} governorates`);
        return rows;
    } catch (e) {
        console.warn('  ⚠️  GA4 regions failed:', e.message);
        return [];
    }
}

// ── Build output ──────────────────────────────────────────────────────────────
const countries   = parseCountries(locData);
const gcRegions   = parseRegions(locIqData);
const ga4Regions  = gcRegions.length ? [] : await fetchGA4Regions(); // skip GA4 if GC has data
const regions     = gcRegions.length ? gcRegions : (ga4Regions.length ? ga4Regions : parseRegions(locData));
const totalHits  = countries.reduce((s, c) => s + c.count, 0);

// Keep existing hits + monthly history from previous run
const CACHE = 'js/analytics.json';
let prevHits = [], monthly = [];
if (existsSync(CACHE)) {
    try {
        const prev = JSON.parse(readFileSync(CACHE,'utf8'));
        prevHits = prev.hits    || [];
        monthly  = prev.monthly || [];
    } catch {}
}

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
    refs:      parseRefs(refData, campData),
    languages: parseLangs(langData),
    monthly,
};

writeFileSync(CACHE, JSON.stringify(analytics, null, 2), 'utf8');
console.log('✅ Done.',
    '| Countries:', analytics.locations.length,
    '| Governorates:', analytics.regions.length,
    '| Browsers:', analytics.browsers.length,
    '| OS:', analytics.systems.length,
    '| Refs:', analytics.refs.length,
    '| Total hits:', analytics.totalHits);
