# Purchase Funnel — End-to-End QA Checklist
_Goal: prove the monetization chain actually logs in PostHog: `paywall_shown` → `checkout_initiated` → `purchase_completed`._

## Why this is needed
As of 2026-06-16 these events have **never fired** (0 in PostHog): `auth_wall_shown`, `paywall_shown`, `checkout_initiated`, `purchase_verified`. The cause is **funnel depth, not (necessarily) a bug** — every completed analysis so far was an unlocked 1st/2nd scan, so nobody reached the wall. The code paths are therefore **unproven**. This test proves them.

## What was added to enable the test
1. **Server-side purchase event** — `src/app/api/stripe/webhook/route.ts` now emits **`purchase_completed`** to PostHog on every Stripe-confirmed payment (`checkout.session.completed`). This is the reliable revenue signal; the client `purchase_verified` is adblock-fragile and only fires on the success redirect.
2. **Force-the-wall hook** — feature flag **`paywall-placement`**, variant **`early_gate`**, pay-locks the detailed result on **scan 1**. Default variant is `control` (no behavior change). Use `early_gate` to reach the paywall on demand.

## Test steps
**Prereqs:** Stripe in **TEST mode**; test card `4242 4242 4242 4242`, any future expiry + any CVC. Open PostHog → **Activity / live events** in a second tab. Confirm `NEXT_PUBLIC_POSTHOG_KEY` is set in the server/Vercel env (the webhook needs it).

**A. Force the wall**
1. PostHog → Feature Flags → `paywall-placement`. Either set `early_gate` to 100%, **or** add a release-condition override for your own `distinct_id` / email → `early_gate`.
2. Hard-refresh checkpet.vet so flags reload.

**B. Walk the funnel (watch live events)**
1. Run a scan → complete an analysis. Expect **`analysis_completed`** with `is_pay_locked=true`, and the result blurred behind the pay wall.
   - The wall impression **`paywall_shown`** should fire here (from the `isPayLocked` effect in `page.tsx`). **If it doesn't appear, that capture is the bug — file it.**
2. Click the pay CTA → expect **`checkout_initiated`** `{ product_type }`.
3. Complete Stripe checkout with `4242…` → you're redirected to `/?checkout=success`.
4. Within a few seconds expect **`purchase_completed`** `{ value, product_type, mode, source: "stripe_webhook" }` (server-sent). The client `purchase_verified` should also fire if the success page loaded.

**C. Confirm in the saved insight**
- Open **"Monetization funnel — result → checkout → purchase"** (`/insights/pHarMVI7`). After the test it should show 1 conversion through all three steps.

**D. Reset**
- Set `paywall-placement` back to `control` 100% / `early_gate` 0%.
- Void/refund the Stripe **test** payment.

## Verification query (PostHog SQL)
```sql
SELECT event, count() AS n
FROM events
WHERE event IN ('paywall_shown','checkout_initiated','purchase_completed','purchase_verified')
  AND timestamp > now() - INTERVAL 1 DAY
GROUP BY event
```

## If an event is missing
- **`paywall_shown`** missing but result is blurred → wall-impression capture bug in `page.tsx` (the `useEffect` keyed on `isPayLocked`).
- **`checkout_initiated`** missing → `handleCheckoutPay` not reached, or `posthog` is null at that point.
- **`purchase_completed`** missing after a successful test payment → check the webhook is receiving events (Stripe dashboard → Webhooks), that `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_POSTHOG_KEY` are set server-side, and look for the log line `[PostHog] purchase_completed sent…`.
