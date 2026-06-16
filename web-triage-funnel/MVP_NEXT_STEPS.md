# CheckPet MVP — Prove-It Plan (status)
_Worklog generated 2026-06-16. Companion docs: `PSEO_QUALITY_DIAGNOSIS.md`, `PURCHASE_FUNNEL_QA.md`._

## What shipped in this pass

### P0 — Prove someone will pay
- **Server-side revenue event** — `api/stripe/webhook/route.ts` now sends **`purchase_completed`** to PostHog on every confirmed payment. Reliable revenue signal independent of the client/adblockers. _(code, typechecked)_
- **E2E test path + runbook** — feature flag `paywall-placement` → `early_gate` forces the paywall on scan 1 so the whole chain can be tested on demand. Steps in `PURCHASE_FUNNEL_QA.md`. **← run this; it's the one thing that most proves the MVP.**

### P0 — Acquisition (Google)
- Reframed from "indexing" to **quality-decay** (you confirmed pages are indexed). Full diagnosis + fix plan in `PSEO_QUALITY_DIAGNOSIS.md`. Headline: 2,864 templated YMYL pages → Google site-level quality discount; Bing family still ranks you. Prune + add vet-reviewed E-E-A-T + embed the tool on the page.

### P1 — Trust / quality signal
- **PostHog survey "Result quality & trust (post-analysis)"** created as a **draft**. Triggers on `analysis_completed`; asks helpfulness (1–5), intended next action, and open feedback. **Review and launch from PostHog when ready.**

### P1 — Paywall placement experiment
- **Feature flag `paywall-placement`** (`control` 100% / `early_gate` 0%) wired into `page.tsx`. `early_gate` pay-gates the detailed result on scan 1. Safe no-op until you dial up rollout or convert it into a PostHog Experiment with `analysis_completed` → `purchase_completed` as the metric.

### P2 — Activation + retention measurement (saved insights)
- **North Star — Analyses completed & purchases (daily)** — `/insights/mAwAje9X`
- **Activation funnel — CTA → start → complete** — `/insights/d3lUgnto`
- **Monetization funnel — result → checkout → purchase** — `/insights/pHarMVI7`

## Your move (in order)
1. **Run the purchase-funnel QA** (`PURCHASE_FUNNEL_QA.md`) in Stripe test mode. Nothing else matters until one payment logs end-to-end.
2. **Launch the result survey** (one click in PostHog) to start collecting trust/helpfulness data.
3. **Pull Search Console** specifics from `PSEO_QUALITY_DIAGNOSIS.md` and start pruning + E-E-A-T.
4. When traffic supports it, **promote `paywall-placement` to a real experiment** and roll `early_gate` to 50%.

## Deploy notes
- Two code files changed: `api/stripe/webhook/route.ts`, `app/page.tsx`. `tsc --noEmit` passes (0 errors). Not deployed — review the diff and ship via your normal flow.
- PostHog objects (flag, survey, 3 insights) are **live now** in project 312679. The survey is a draft; the flag is control-only — neither affects users until you act.
