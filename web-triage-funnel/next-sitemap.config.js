/** @type {import('next-sitemap').IConfig} */

// Top pages by Search Console impressions/clicks. Add your winners here to concentrate
// crawl budget + authority on them WITHOUT removing or down-ranking the long tail.
// (Authority concentration via priority, not pruning — see PSEO_QUALITY_DIAGNOSIS.md.)
const FEATURED_SLUGS = new Set([
    // 'dog-black-tarry-stools',
    // 'cat-abdomen-feels-hard-and-bloated',
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
