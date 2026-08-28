# Triage regression suite

Two scripts that exercise the deployed `analyze-symptom` edge function end to end.
There is no unit-test harness for the clinical output, so these are the guard rails:
run them before and after any change to the function, its prompts, or the model.

Both read Supabase credentials from `web-triage-funnel/.env.local` and hit the LIVE
function. Each full run costs ~20 Gemini calls and ~70s.

## golden-cases.mjs

Ten fixed cases spanning urgency tiers, body systems, and both species. For each it
runs the initial pass, answers the model's own clarifying questions with a fixed
policy (Q1 Yes, Q2 Unsure, rest No), then runs the refinement pass.

    node scripts/triage-regression/golden-cases.mjs <label> [legacy|fixed|both]

  legacy  what the client sent before Aug 2026: refinedSymptoms: [], no initialCauses
  fixed   what it sends now: both populated

Writes `out/<label>.json` with full request/response bodies so two runs can be diffed.
Watch `refined=true` on every row — if it reports false, refinement mode has regressed
and the clarifying questions are being ignored again (see the Aug 2026 fix).

## safety-suite.mjs

Five scenarios asserting on urgency after refinement. These cover the two safety rules
that live only in the refinement prompt — "Unsure = HIGH RISK" and the life-threatening
"Safety Override" — which were dead code until Aug 2026.

    node scripts/triage-regression/safety-suite.mjs

Exits non-zero on any failure. Expected: 5 passed, 0 failed.

## Baselines (28 Aug 2026, function v76)

  golden-cases  60/60 calls succeeded, 0 empty-cause results, refinement engaged 30/30
  safety-suite  5 passed, 0 failed
