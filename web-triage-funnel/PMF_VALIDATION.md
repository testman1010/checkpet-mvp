# CheckPet — PMF Validation Plan & Findings
_Generated 2026-06-16 from PostHog (project 312679) + codebase. Companion to MVP_NEXT_STEPS.md._

## Verdict so far
Acquisition and activation work; **retention and organic pull are effectively zero.** Today CheckPet behaves as a one-shot, push-acquired utility — not a retained product. That isn't fatal (a one-time-purchase emergency tool can be a real business), but it means the **$9.99 subscription has no behavioral basis yet**, and PMF should be judged on the **one-time-purchase loop first**.

## The three findings

### 1. Frequency / retention ≈ 0 — the core risk
Of users who ran 2–4 analyses, the **median time between their first and last scan is 0.0 days** — everyone who scans more than once does it in a single sitting. There is no measured cross-day return. For a symptom checker this is partly inherent (pets aren't sick often), but recurring revenue currently has nothing to stand on.

### 2. Pull vs push: 341 new vs 2 returning
Of everyone active since the 6/12 deploy, **341 were brand-new and 2 were returning** (~0.6%). Traffic is almost entirely first-touch acquisition; the large "$direct" bucket is new visitors, not loyal returners. No organic-pull signal yet (no returning / branded / word-of-mouth base).

### 3. Where demand concentrates (segment of love — directional)
Completions are too few to rank (cat 6 / dog 5; `urgency_level` wasn't captured — tracking gap, see below). But pSEO **traffic** concentrates in two clusters:
- **Acute emergencies** — ate ibuprofen/Tylenol, unproductive retching (bloat/GDV), coffee-ground vomit, circling / loss of balance, fast breathing while sleeping.
- **Dog male-urogenital** — several penis/preputial-discharge queries in the top 6 by traffic.

The emergency cluster is the natural wedge: highest anxiety, most time-sensitive, clearest willingness to pay.

## The six instruments (status)
0. **Frequency/retention** — analyzed above. Add a "what brought you back?" capture once returns exist.
1. **Sean Ellis disappointment test** — ✅ LIVE (in-app, fires after a completed analysis). >40% "very disappointed" = PMF. [Survey](https://us.posthog.com/project/312679/surveys/019ed24d-db93-0000-deeb-48cab6edeeb0)
2. **Outcome & accuracy survey** — ✅ LIVE (hosted form, link from the nurture email). Validates whether the triage was *right*, not just liked. [Survey](https://us.posthog.com/project/312679/surveys/019ed24d-e5b4-0000-95b3-48c7e01fe9f1)
3. **Segment of love** — analyzed; tighten once volume + urgency tracking allow.
4. **CAC:LTV gate** — framework below; [Revenue $ insight](https://us.posthog.com/project/312679/insights/cHCvZgNu) built.
5. **Pull vs push** — analyzed above; re-run monthly to watch the returning-% move.

## CAC:LTV gate (apply the moment purchases exist)
- **CAC** = Meta ad spend ÷ purchases (same period).
- **Value/buyer** ≈ $3.99 one-time, or $9.99/mo × retained months for subscriptions.
- **Gate:** if CAC > ~$4 with no repeat purchases, the paid + one-time model doesn't clear — "no PMF for paid acquisition," regardless of how much users like it.
- **Watch:** [Revenue $](https://us.posthog.com/project/312679/insights/cHCvZgNu) · [Monetization funnel](https://us.posthog.com/project/312679/insights/pHarMVI7) · [North Star](https://us.posthog.com/project/312679/insights/mAwAje9X). You supply the ad spend.

## Decision points
- **Don't scale paid spend** until (a) the purchase funnel logs end-to-end and (b) CAC < value/buyer.
- **Pick the lane:** if retention stays ~0, position and price as a **one-time emergency tool** (drop/rethink the subscription) — *or* build a real return reason (pet health record, condition monitoring, re-check reminders, multi-pet) and re-measure.
- **Kill/pivot signal:** Sean Ellis <20% "very disappointed" AND retention ~0 AND CAC > value → no PMF on the current shape; change the wedge or the model.
- **Green-light signal:** emergency-segment users convert to purchase, Sean Ellis >40%, and the outcome survey shows the triage is accurate → narrow hard on acute emergencies and scale.

## Tracking gap to fix
`urgency_level` is not landing on `analysis_completed` (returns null). Fix the captured property so you can segment conversion/retention by urgency — it's central to confirming the emergency wedge.
