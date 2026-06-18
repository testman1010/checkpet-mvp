# CheckPet — Sprint 1 Backlog (2 weeks)
_Jun 17 – Jun 30, 2026 · Generated 2026-06-16_

## Sprint goal
**Prove that a stranger will pay, per incident, in the acute-emergency wedge — and verify it end-to-end in analytics.** Everything else (SEO unlock, wedge UX, measurement) serves that one outcome.

## Thesis this sprint executes
The data says CheckPet is an **SEO-acquired, acute-emergency triage tool monetized per incident**. We lean into emergencies, prove one-time payment, and unlock Google. **Subscription and retention are explicitly out of scope** this sprint — separate, later bets.

## Definition of done (sprint-level success metrics)
- [ ] ≥1 `purchase_completed` logged **end-to-end** (test card, ideally ≥1 real) — chain `paywall_shown → checkout_initiated → purchase_completed` verified.
- [ ] `urgency_level` populating on ≥90% of new `analysis_completed` events.
- [ ] `paywall-placement` experiment running (early_gate exercised, not 0%).
- [ ] Emergency-segment funnel insight live.
- [ ] Top ~50 emergency pages identified in Search Console and added to `FEATURED_SLUGS`; sitemap resubmitted.
- [ ] Outcome survey wired into the nurture email.

## Sizing
**S** ≤ 2h · **M** ~half day · **L** ~1–2 days · roles: `[eng]` `[growth]` `[content]` `[founder]`

---

## P0 — Ship & prove revenue (the whole point of the sprint)

- [ ] **R1 · Deploy the batch to prod** `[founder]` **S**
  Commit + push `main` (webhook purchase event, paywall flag, pSEO E-E-A-T, urgency fix, sitemap, 2,864 cleaned JSONs). _Done when:_ Vercel deploy is green, result page renders, no console errors.
- [ ] **R2 · Post-deploy smoke test** `[eng]` **S** · _dep: R1_
  Run one analysis; confirm the urgency badge shows a real level and `isEmergency` styling fires on a CRITICAL/URGENT case. _Done when:_ urgency renders correctly (proves the urgency_level fix).
- [ ] **R3 · Verify purchase funnel end-to-end** `[eng/founder]` **M** · _dep: R1_ · ⭐ keystone
  Follow `PURCHASE_FUNNEL_QA.md`: set `paywall-placement → early_gate` for yourself, Stripe **test** card, walk the wall. _Done when:_ `paywall_shown → checkout_initiated → purchase_completed` all fire and the Revenue $ insight shows 1.
- [ ] **R4 · Confirm `urgency_level` in events** `[eng]` **S** · _dep: R1_
  Run the verification SQL; confirm new completions carry CRITICAL/URGENT/etc., not null.
- [ ] **R5 · Roll `paywall-placement` early_gate to 50%** `[founder]` **S** · _dep: R3_
  Turn the experiment on so the paywall is actually exercised on scan 1 (repeat-scan gating never triggers). _Done when:_ flag at 50/50 and `analysis_completed.is_pay_locked` shows a split.

## P0 — Sharpen the emergency wedge

- [ ] **W1 · Emergency-first result screen** `[eng]` **L** · _dep: R2_
  For CRITICAL/URGENT, lead with "**What to do right now**" + nearest-ER guidance and frame the paywall value around the emergency; de-emphasize upsell for low-urgency. _Done when:_ emergency results visibly differ from low-urgency ones.
- [ ] **W2 · Narrow homepage + hero copy to the emergency moment** `[content]` **M**
  Reposition around "Is this a pet emergency? Get an instant answer before you rush to the ER." _Done when:_ homepage + top pSEO CTA copy lead with the emergency framing.

## P1 — Unlock Google (latent multiplier)

- [ ] **S1 · Pull Search Console data** `[founder]` **S**
  Export top pages by impressions/clicks + average position; note Google vs Bing gap and any "Crawled – not indexed."
- [ ] **S2 · Pick the top ~50 emergency pages → `FEATURED_SLUGS`** `[growth]` **S** · _dep: S1_
  Add winning emergency-symptom slugs to `next-sitemap.config.js` to concentrate authority.
- [ ] **S3 · Upgrade those 50 first** `[content]` **M** · _dep: S2_
  Spot-check 5 live: schema renders, internal links, content depth. Prioritize emergency intent.
- [ ] **S4 · Resubmit sitemap + request indexing** `[founder]` **S** · _dep: R1, S3_

## P1 — Measurement & feedback

- [ ] **M1 · Emergency-segment funnel insight** `[eng]` **S** · _dep: R4_
  `analysis_completed` (urgency ∈ CRITICAL/URGENT) → `checkout_initiated` → `purchase_completed`. Answers "do emergencies convert better?"
- [ ] **M2 · Wire outcome survey into the nurture email** `[eng]` **M**
  Add the hosted outcome-survey link (Share URL) as a step in `api/email/nurture`. _Done when:_ a nurtured user receives the accuracy/outcome ask.
- [ ] **M3 · Monitor live surveys** `[founder]` **S, ongoing**
  Watch result-quality + Sean Ellis responses; jot early reads (helpfulness, % "very disappointed").

## P2 — Acquisition test (stretch; only after R3)

- [ ] **A1 · Small paid emergency test** `[growth]` **M** · _dep: R3, W1_ · gate: funnel verified
  Low daily budget on Meta with the existing late-night-emergency creative, routed to a top emergency page, to generate enough volume to read conversion. Track CAC vs the $3.99 price.

---

## Suggested sequence
**Week 1:** R1 → R2 → R3 → R4 → R5 (revenue proof), W1/W2 (wedge), S1 (SEO data).
**Week 2:** S2–S4 (SEO upgrade), M1–M2 (measurement + outcome loop), A1 if R3 passed; end-of-sprint read of surveys + emergency funnel.

## Explicitly NOT this sprint
Subscription, retention/health-record features, generating new pSEO pages, scaling paid spend. Revisit only after per-incident payment + emergency conversion are proven.
