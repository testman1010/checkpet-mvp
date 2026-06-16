# CheckPet pSEO — Quality Fix Plan (balanced, no surface-area loss)
_Updated 2026-06-16 after reading the template + page data. Supersedes the first-pass "prune hard" version._

## Correction from the first pass
The pSEO template (`src/app/check/[slug]/page.tsx`) is already well-built: `MedicalWebPage` + `FAQPage` JSON-LD, internal cross-linking (`RelatedSymptomsWidget`), hero + sticky CTAs, canonical tags, and **FAQs populated on all 2,864 pages**. This is **not** a missing-infrastructure problem and does **not** require deleting pages — which fits your constraint of preserving surface area.

## The headline problem: fabricated medical reviewers
Every page shows "**Protocol reviewed by Dr. ___, DVM**", drawn from **8 invented veterinarians** rotated across all 2,864 pages:

> Dr. Sarah Miller DVM (395), Dr. Laura Wilson DVM (387), Dr. David Smith BVSc (369), Dr. Michael Ross DVM (363), Dr. Jessica Williams DVM (352), Dr. Emily Chen DVM (347), Dr. Robert Taylor DVM (329), **Dr. James Herriot BVMS (322) — a fictional vet**.

Each name is also emitted as schema.org **`reviewedBy` Person** markup. For a YMYL (Your-Money-or-Your-Life) pet-health site, fabricated authorship/expertise is specifically targeted by Google's spam & quality systems and is a **plausible direct contributor to the Google suppression** — not just a cosmetic issue. This must be replaced with honest attribution.

## Balanced approach (preserve surface area)
Your instinct is correct: Bing / DuckDuckGo / Yahoo send real traffic to these pages, so blanket `noindex`/deletion would discard working surface area. Therefore:
- **Keep all 2,864 pages indexed.** No deletion, no blanket noindex.
- **Fix quality via TRUST signals** (the lever Google is actually penalizing), not page count.
- **Concentrate authority on winners additively** — raise sitemap priority + add internal links toward your best pages — without down-ranking the tail.
- **Only** consider *reversible* `noindex` for pages with proven **zero impressions AND zero clicks over 90 days** (from Search Console), and only **later**, after the trust fixes have had time to work.

## Fix list (all no-page-loss, ship to every page via the template)
1. **Replace fabricated reviewers with honest attribution** — biggest lever. ✅ Done: org-level (CheckPet Editorial Team) + Merck citation + medical disclaimer.
2. **Enrich `MedicalWebPage` schema honestly:** `lastReviewed`/`dateModified`, `citation` (Merck Veterinary Manual, already referenced), `publisher` Organization (+ logo), `about` MedicalCondition, `inLanguage`.
3. **Add a visible medical disclaimer** ("informational, not a substitute for veterinary care") — a positive YMYL signal.
4. **Concentrate authority:** customize `next-sitemap.config.js` (currently bare/default) to set higher `priority` + real `lastmod` on top pages; strengthen internal links from many pages to your best ones. Feed the winner list from Search Console top pages.
5. **Measure recovery:** Search Console (Google referrers, average position on upgraded pages, CTR) + PostHog (`pseo_time_on_page`, CTA → `analysis_started`).

## Sequencing
Do **1 + 2 + 3** first — one sitewide template change, ships to all 2,864 pages at once, removes nothing. Then **4**. Hold any (very limited, reversible) pruning until the trust fixes are measured.

## Implemented in this pass (2026-06-16) — typechecked, not deployed
- **`src/app/check/[slug]/page.tsx`** — removed the 8 fabricated reviewers and the `reviewedBy: Person` schema. Now: organization-level authorship (CheckPet Editorial Team); `MedicalWebPage` enriched with `citation` (Merck Veterinary Manual), `publisher` + logo, `about` (MedicalCondition), `inLanguage`, and a real `dateModified`; the visible byline is now "Compiled by the CheckPet Editorial Team, aligned with the Merck Veterinary Manual. Last updated &lt;date&gt;." followed by a medical disclaimer.
- **`src/data/pages/*.json`** — stripped the fabricated `reviewer_name` field from **all 2,864 files** (validated; `faqs` preserved). No page removed.
- **`next-sitemap.config.js`** — added priority tiering (home 1.0, `/check/` 0.6, featured winners 0.8) + `autoLastmod`, concentrating authority **without** removing or down-ranking pages.

### Still your move
- Pull **Search Console** top pages and paste their slugs into `FEATURED_SLUGS` in `next-sitemap.config.js` to boost your proven winners.
- Optionally engage a **real veterinarian reviewer** later (strongest E-E-A-T) — the byline + schema are now trivially pointed at a real person.
- Watch Google referrers + average position recover before considering any reversible pruning.

