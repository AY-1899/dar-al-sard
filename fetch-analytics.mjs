import { writeFileSync } from 'fs';

const GC_BASE = 'https://daralsard.goatcounter.com/api/v0';
const TOKEN   = process.env.GC_TOKEN;

if (!TOKEN) { console.error('GC_TOKEN not set'); process.exit(1); }

const end   = new Date().toISOString().split('T')[0];
const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

async function gc(path, extra = {}) {
    const params = new URLSearchParams({ start, end, limit: 15, ...extra });
    const r = await fetch(`${GC_BASE}${path}?${params}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    return r.json();
}

try {
    const [hits, locations, regions, browsers, systems, sizes, refs] = await Promise.all([
        gc('/stats/hits'),
        gc('/stats/locations'),
        gc('/stats/locations', { filter: 'IQ' }),   // Iraqi governorates
        gc('/stats/browsers'),
        gc('/stats/systems'),
        gc('/stats/sizes'),
        gc('/stats/toprefs'),
    ]);

    const analytics = {
        updated: new Date().toISOString(),
        period:  { start, end },
        hits:      (hits.hits          || []).slice(0, 10),
        locations: (locations.locations || []).slice(0, 10),
        regions:   (regions.locations   || []).filter(l => l.id !== 'IQ').slice(0, 10),
        browsers:  (browsers.browsers   || []).slice(0, 8),
        systems:   (systems.systems     || []).slice(0, 8),
        sizes:     (sizes.sizes         || []).slice(0, 6),
        refs:      (refs.refs           || []).slice(0, 10),
    };

    writeFileSync('js/analytics.json', JSON.stringify(analytics, null, 2), 'utf8');
    console.log('✅ Analytics saved. Period:', start, '→', end);
    console.log('   Hits:', analytics.hits.length, '| Locations:', analytics.locations.length,
        '| Regions (IQ):', analytics.regions.length);
} catch (e) {
    console.error('❌ Failed:', e.message);
    process.exit(1);
}
