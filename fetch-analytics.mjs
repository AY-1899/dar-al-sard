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
const hitsData      = await fetchStat('hits', '', 200);

// ── Arabic name maps ──────────────────────────────────────────────────────────
// ISO 3166-1 alpha-2 → Arabic. IL and PS both map to فلسطين.
const COUNTRIES = {
    // Arab world
    'IQ':'العراق',        'SA':'السعودية',      'AE':'الإمارات',
    'KW':'الكويت',        'JO':'الأردن',         'SY':'سوريا',
    'LB':'لبنان',         'EG':'مصر',            'YE':'اليمن',
    'OM':'عُمان',         'BH':'البحرين',        'QA':'قطر',
    'LY':'ليبيا',         'TN':'تونس',           'DZ':'الجزائر',
    'MA':'المغرب',        'SD':'السودان',        'SO':'الصومال',
    'MR':'موريتانيا',     'KM':'جزر القمر',      'DJ':'جيبوتي',
    // Palestine — IL (Israel) also logged as Palestine
    'PS':'فلسطين',        'IL':'فلسطين',
    // Europe
    'TR':'تركيا',         'DE':'ألمانيا',        'GB':'المملكة المتحدة',
    'FR':'فرنسا',         'IT':'إيطاليا',        'ES':'إسبانيا',
    'NL':'هولندا',        'BE':'بلجيكا',         'SE':'السويد',
    'NO':'النرويج',       'DK':'الدنمارك',       'FI':'فنلندا',
    'PL':'بولندا',        'AT':'النمسا',         'CH':'سويسرا',
    'PT':'البرتغال',      'GR':'اليونان',        'CZ':'التشيك',
    'HU':'المجر',         'RO':'رومانيا',        'BG':'بلغاريا',
    'HR':'كرواتيا',       'SK':'سلوفاكيا',       'SI':'سلوفينيا',
    'LT':'ليتوانيا',      'LV':'لاتفيا',         'EE':'إستونيا',
    'IE':'أيرلندا',       'IS':'آيسلندا',        'LU':'لوكسمبورغ',
    'MT':'مالطا',         'CY':'قبرص',           'AL':'ألبانيا',
    'MK':'مقدونيا الشمالية', 'RS':'صربيا',       'BA':'البوسنة والهرسك',
    'ME':'الجبل الأسود',  'XK':'كوسوفو',         'MD':'مولدوفا',
    'UA':'أوكرانيا',      'BY':'بيلاروسيا',      'RU':'روسيا',
    'LI':'ليختنشتاين',    'MC':'موناكو',         'SM':'سان مارينو',
    'AD':'أندورا',        'VA':'الفاتيكان',
    // Americas
    'US':'الولايات المتحدة', 'CA':'كندا',        'MX':'المكسيك',
    'BR':'البرازيل',      'AR':'الأرجنتين',      'CL':'تشيلي',
    'CO':'كولومبيا',      'PE':'بيرو',           'VE':'فنزويلا',
    'EC':'الإكوادور',     'BO':'بوليفيا',        'PY':'باراغواي',
    'UY':'أوروغواي',      'GY':'غيانا',          'SR':'سورينام',
    'GT':'غواتيمالا',     'HN':'هندوراس',        'SV':'السلفادور',
    'NI':'نيكاراغوا',     'CR':'كوستاريكا',      'PA':'بنما',
    'CU':'كوبا',          'DO':'جمهورية الدومينيكان', 'HT':'هايتي',
    'JM':'جامايكا',       'TT':'ترينيداد وتوباغو',
    // Asia & Oceania
    'CN':'الصين',         'JP':'اليابان',        'KR':'كوريا الجنوبية',
    'IN':'الهند',         'PK':'باكستان',        'BD':'بنغلاديش',
    'AF':'أفغانستان',     'IR':'إيران',          'ID':'إندونيسيا',
    'MY':'ماليزيا',       'TH':'تايلاند',        'VN':'فيتنام',
    'PH':'الفلبين',       'SG':'سنغافورة',       'MM':'ميانمار',
    'KH':'كمبوديا',       'LA':'لاوس',           'NP':'نيبال',
    'LK':'سريلانكا',      'MV':'المالديف',       'BT':'بوتان',
    'MN':'منغوليا',       'KZ':'كازاخستان',      'UZ':'أوزبكستان',
    'TM':'تركمانستان',    'KG':'قيرغيزستان',     'TJ':'طاجيكستان',
    'GE':'جورجيا',        'AM':'أرمينيا',        'AZ':'أذربيجان',
    'AU':'أستراليا',      'NZ':'نيوزيلندا',      'FJ':'فيجي',
    'PG':'بابوا غينيا الجديدة',
    // Africa
    'NG':'نيجيريا',       'ET':'إثيوبيا',        'KE':'كينيا',
    'GH':'غانا',          'TZ':'تنزانيا',        'UG':'أوغندا',
    'ZA':'جنوب أفريقيا', 'CM':'الكاميرون',       'CI':'ساحل العاج',
    'SN':'السنغال',       'ML':'مالي',           'BF':'بوركينا فاسو',
    'NE':'النيجر',        'TD':'تشاد',           'CF':'جمهورية أفريقيا الوسطى',
    'CG':'الكونغو',       'CD':'جمهورية الكونغو الديمقراطية',
    'AO':'أنغولا',        'MZ':'موزمبيق',        'ZM':'زامبيا',
    'ZW':'زيمبابوي',      'MW':'مالاوي',         'RW':'رواندا',
    'BI':'بوروندي',       'SS':'جنوب السودان',   'ER':'إريتريا',
    'MG':'مدغشقر',        'MU':'موريشيوس',       'SC':'سيشيل',
    'GM':'غامبيا',        'GN':'غينيا',          'GW':'غينيا بيساو',
    'SL':'سيراليون',      'LR':'ليبيريا',        'TG':'توغو',
    'BJ':'بنين',          'GA':'الغابون',        'GQ':'غينيا الاستوائية',
    'ST':'ساو تومي وبرينسيبي', 'CV':'الرأس الأخضر', 'NA':'ناميبيا',
    'BW':'بوتسوانا',      'LS':'ليسوتو',         'SZ':'إسواتيني',
};

// Fallback: translate any English country name that slipped through
const EN_TO_AR = {
    'Iraq':'العراق', 'Saudi Arabia':'السعودية', 'United Arab Emirates':'الإمارات',
    'Kuwait':'الكويت', 'Jordan':'الأردن', 'Syria':'سوريا',
    'Lebanon':'لبنان', 'Egypt':'مصر', 'Yemen':'اليمن',
    'Oman':'عُمان', 'Bahrain':'البحرين', 'Qatar':'قطر',
    'Libya':'ليبيا', 'Tunisia':'تونس', 'Algeria':'الجزائر',
    'Morocco':'المغرب', 'Sudan':'السودان', 'Somalia':'الصومال',
    'Palestine':'فلسطين', 'Israel':'فلسطين', 'West Bank':'فلسطين',
    'Gaza':'فلسطين', 'Gaza Strip':'فلسطين',
    'Turkey':'تركيا', 'Germany':'ألمانيا', 'United Kingdom':'المملكة المتحدة',
    'France':'فرنسا', 'Italy':'إيطاليا', 'Spain':'إسبانيا',
    'Netherlands':'هولندا', 'Belgium':'بلجيكا', 'Sweden':'السويد',
    'Norway':'النرويج', 'Denmark':'الدنمارك', 'Finland':'فنلندا',
    'Poland':'بولندا', 'Austria':'النمسا', 'Switzerland':'سويسرا',
    'Portugal':'البرتغال', 'Greece':'اليونان', 'Russia':'روسيا',
    'Ukraine':'أوكرانيا', 'Liechtenstein':'ليختنشتاين',
    'United States':'الولايات المتحدة', 'Canada':'كندا', 'Mexico':'المكسيك',
    'Brazil':'البرازيل', 'Argentina':'الأرجنتين', 'Chile':'تشيلي',
    'China':'الصين', 'Japan':'اليابان', 'South Korea':'كوريا الجنوبية',
    'India':'الهند', 'Pakistan':'باكستان', 'Iran':'إيران',
    'Indonesia':'إندونيسيا', 'Malaysia':'ماليزيا', 'Thailand':'تايلاند',
    'Australia':'أستراليا', 'New Zealand':'نيوزيلندا',
    'Nigeria':'نيجيريا', 'Ethiopia':'إثيوبيا', 'Kenya':'كينيا',
    'South Africa':'جنوب أفريقيا', 'Ghana':'غانا',
};

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseCountries(data) {
    if (!data) return [];
    const merged = {};
    for (const r of (data.stats || [])) {
        // Resolve name: ISO code map → English name map → raw name → code
        const arName = COUNTRIES[r.id]
            || EN_TO_AR[r.name]
            || (r.name && /^[؀-ۿ]/.test(r.name) ? r.name : null) // already Arabic
            || r.name || r.id || '—';
        merged[arName] = (merged[arName] || 0) + (r.count || 0);
    }
    return Object.entries(merged)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
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

// ── PDF downloads per book ────────────────────────────────────────────────────
function parsePdfDownloads(data) {
    if (!data) return { total: 0, books: [] };
    const hits = data.hits || [];
    // Per-book entries: path is pdf/{id} (new-style event tracking)
    const books = hits
        .filter(h => /^\/?pdf\/\d+$/.test(h.path))
        .map(h => ({ title: h.title || h.path, count: h.count || 0 }))
        .sort((a, b) => b.count - a.count);
    // Also count old-style pdf-download events (single bucket, no per-book breakdown)
    const oldTotal = hits
        .filter(h => /^\/?pdf-download$/.test(h.path))
        .reduce((s, h) => s + (h.count || 0), 0);
    const total = books.reduce((s, b) => s + b.count, 0) + oldTotal;
    console.log(`  ✅ PDF downloads: ${total} total (${books.length} books + ${oldTotal} legacy events)`);
    return { total, books };
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
    downloads:    parsePdfDownloads(hitsData).total,
    pdfDownloads: parsePdfDownloads(hitsData).books,
    hits:         prevHits,
    locations:    countries,
    regions:      [],
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
