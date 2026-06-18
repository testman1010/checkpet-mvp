/** @type {import('next-sitemap').IConfig} */

// Top pages by Search Console impressions/clicks. Add your winners here to concentrate
// crawl budget + authority on them WITHOUT removing or down-ranking the long tail.
// (Authority concentration via priority, not pruning — see PSEO_QUALITY_DIAGNOSIS.md.)
// Seeded from PostHog top-traffic pages (last ~30d), emergency-leaning.
// REFINE with Search Console impressions/clicks once pulled (see SPRINT_01_BACKLOG.md · S1/S2).
const FEATURED_SLUGS = new Set([
    'dog-gum-chewing-motion-no-food',
    'dog-unproductive-retching',
    'dog-ate-ibuprofen-or-tylenol',
    'cat-walking-in-circles-or-loss-of-balance',
    'cat-vomiting-liquid-resembling-coffee-grounds',
    'dog-fast-breathing-rate-over-40-breaths-per-minute-while-sleeping',
    'dog-refusing-to-eat-and-lying-still',
    'dog-puppy-breathing-fast-while-sleeping',
    'dog-yelping-during-bowel-movement',
    'cat-hard-dry-pebble-like-stool',
    'dog-hoarse-bark-and-voice-loss',
    'dog-growth-or-tumor-on-penis',
    'dog-preputial-discharge-that-is-yellow-green',
    'dog-constant-dripping-of-blood-from-penis',
    'dog-excessive-licking-of-genital-area',
]);

module.exports = {
    siteUrl: 'https://checkpet.vet',
    generateRobotsTxt: true,
    autoLastmod: true,
    changefreq: 'weekly',
    priority: 0.7,
    transform: async (config, urlPath) => {
        // Core surfaces get top priority; long-tail /check/ content sits slightly lower
        // so authority concentrates on the highest-value pages. Featured winners are boosted.
        let priority = 0.7;
        let changefreq = 'weekly';

        if (urlPath === '/') {
            priority = 1.0;
        } else if (['/about', '/privacy', '/terms'].includes(urlPath)) {
            priority = 0.5;
            changefreq = 'monthly';
        } else if (urlPath.startsWith('/check/')) {
            const slug = urlPath.replace('/check/', '');
            priority = FEATURED_SLUGS.has(slug) ? 0.8 : 0.6;
            changefreq = 'monthly';
        }

        return {
            loc: urlPath,
            changefreq,
            priority,
            lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
        };
    },
};
