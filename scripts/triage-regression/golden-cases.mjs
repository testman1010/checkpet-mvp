/**
 * Golden-case regression harness for CheckPet's analyze-symptom edge function.
 *
 * Runs a fixed set of cases through the live function and records the output so
 * "before" and "after" runs can be diffed. Two payload shapes are supported for
 * the refinement leg:
 *
 *   legacy  — exactly what the app sends today: refinedSymptoms: [], no initialCauses.
 *   fixed   — what the app should send: refinedSymptoms populated, initialCauses passed.
 *
 * Usage:  node run.mjs <label> [legacy|fixed|both]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = '/Users/wilsonwu/pet-app-v2/checkpet_mvp_production/web-triage-funnel/.env.local';

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = loadEnv();
// ANALYZE_URL points the suite at a candidate build (e.g. one served by ./serve-local.sh) so a
// change can be tested before it is deployed. Defaults to production.
const URL = process.env.ANALYZE_URL || `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-symptom`;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* ── The cases. Chosen to span urgency tiers, body systems, and both species. ── */
const CASES = [
  { id: 'dog-spinal',      species: 'dog', weight_lbs: 45, age_years: 6,
    symptom: 'Potential Issue: difficulty standing and controlling bladder \n\nDetails: Loss of bladder and bowel control. Heavy breathing. Arching' },
  { id: 'cat-ear-twitch',  species: 'cat', weight_lbs: 10, age_years: 4,
    symptom: 'Potential Issue: involuntary ear twitching \n\nDetails: My cat is showing signs of involuntary ear twitching' },
  { id: 'dog-bloat',       species: 'dog', weight_lbs: 80, age_years: 7,
    symptom: 'Potential Issue: swollen hard abdomen \n\nDetails: Belly is hard and distended, retching without bringing anything up, pacing and drooling for the last hour' },
  { id: 'cat-urinary',     species: 'cat', weight_lbs: 12, age_years: 5,
    symptom: 'Potential Issue: straining in litter box \n\nDetails: Male cat going in and out of the litter box for hours, crying, nothing coming out' },
  { id: 'dog-ibuprofen',   species: 'dog', weight_lbs: 30, age_years: 3,
    symptom: 'Potential Issue: swallowed human ibuprofen \n\nDetails: Ate about 4 ibuprofen tablets roughly an hour ago' },
  { id: 'dog-callus',      species: 'dog', weight_lbs: 70, age_years: 9,
    symptom: 'Potential Issue: hard callus on hock \n\nDetails: Thickened hairless patch on the hock, been there for months, not bothering him' },
  { id: 'cat-breathing',   species: 'cat', weight_lbs: 11, age_years: 11,
    symptom: 'Potential Issue: open mouth breathing \n\nDetails: Breathing fast with mouth open, hiding under the bed, gums look pale' },
  { id: 'dog-eye',         species: 'dog', weight_lbs: 25, age_years: 4,
    symptom: 'Potential Issue: cloudy painful eye \n\nDetails: Squinting, eye looks cloudy and is watering, started yesterday' },
  { id: 'cat-chin-acne',   species: 'cat', weight_lbs: 9,  age_years: 3,
    symptom: 'Potential Issue: black specks on chin \n\nDetails: Black crusty specks under the chin, a bit red, cat does not seem bothered' },
  { id: 'dog-seizure',     species: 'dog', weight_lbs: 55, age_years: 8,
    symptom: 'Potential Issue: two seizures in one day \n\nDetails: Had two full body seizures today about six hours apart, disoriented in between' },
];

function petFor(c) {
  return {
    species: c.species, sex: 'MALE', neutered: true, breed: '',
    age_years: c.age_years, age_months: 0,
    weight_lbs: c.weight_lbs, weight_description: 'Med (15-45 lbs)',
    is_profile_verified: false,
  };
}

async function call(body, attempt = 1) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 120000);
  try {
    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(to);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { __unparseable: text.slice(0, 800) }; }
    return { status: r.status, json };
  } catch (e) {
    clearTimeout(to);
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      return call(body, attempt + 1);
    }
    return { status: 0, json: { __transport_error: String(e) } };
  }
}

/**
 * Answer policy: first question YES (rule-in), second UNSURE (safety default),
 * remainder NO. Deterministic so before/after runs are comparable.
 */
function answerFor(i) {
  if (i === 0) return 'Yes';
  if (i === 1) return 'Unsure';
  return 'No';
}

function summarise(r) {
  const j = r.json || {};
  return {
    status: r.status,
    urgency: j.urgency_level ?? j.urgencyLevel ?? null,
    assessmentPossible: j.assessmentPossible ?? null,
    failureReason: j.failureReason ?? j.error ?? null,
    isRefinedDiagnosis: j.isRefinedDiagnosis ?? null,
    causeCount: Array.isArray(j.causes) ? j.causes.length : null,
    topCause: j.causes?.[0]?.condition ?? null,
    topProb: j.causes?.[0]?.probability ?? null,
    hasRefinementReasoning: !!j.refinement_reasoning,
    refinementReasoningHead: (j.refinement_reasoning || '').slice(0, 160) || null,
    questionCount: Array.isArray(j.verification_questions) ? j.verification_questions.length : null,
    questions: (j.verification_questions || []).map((q) => q.text),
    citationCount: Array.isArray(j.citations) ? j.citations.length : null,
  };
}

async function runCase(c, mode) {
  const initial = await call({
    imageBase64: null, symptom: c.symptom, pet: petFor(c),
    refinedSymptoms: [], initialCauses: [], refinementContext: [],
  });

  const qs = initial.json?.verification_questions || [];
  const history = qs.map((q, i) => ({ question: q.text, answer: answerFor(i) }));
  const yesQuestions = history.filter((h) => h.answer === 'Yes').map((h) => h.question);

  const refinePayload = mode === 'fixed'
    ? { imageBase64: null, symptom: c.symptom, pet: petFor(c),
        refinedSymptoms: yesQuestions,
        initialCauses: initial.json?.causes || [],
        refinementContext: history }
    : { imageBase64: null, symptom: c.symptom, pet: petFor(c),
        refinedSymptoms: [], initialCauses: [], refinementContext: history };

  const refined = qs.length ? await call(refinePayload) : null;

  return {
    case: c.id, mode,
    answers: history,
    initial: summarise(initial),
    refined: refined ? summarise(refined) : null,
    raw: { initial: initial.json, refined: refined?.json ?? null },
  };
}

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
      process.stderr.write(`  ✓ ${items[idx].c.id} [${items[idx].mode}]\n`);
    }
  }));
  return out;
}

const label = process.argv[2] || 'run';
const modeArg = process.argv[3] || 'legacy';
const modes = modeArg === 'both' ? ['legacy', 'fixed'] : [modeArg];

const work = [];
for (const mode of modes) for (const c of CASES) work.push({ c, mode });

console.error(`Running ${work.length} case-runs against ${URL}`);
const started = Date.now();
const results = await pool(work, 3, ({ c, mode }) => runCase(c, mode));
console.error(`Done in ${Math.round((Date.now() - started) / 1000)}s`);

const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(results, null, 2));

// Compact console table for eyeballing
for (const r of results) {
  const i = r.initial, f = r.refined;
  console.log(
    [r.case.padEnd(15), r.mode.padEnd(7),
     `init:${String(i.urgency).padEnd(18)}${String(i.causeCount).padEnd(3)}${String(i.topProb).padEnd(6)}`,
     f ? `ref:${String(f.urgency).padEnd(18)}${String(f.causeCount).padEnd(3)}${String(f.topProb).padEnd(6)}refined=${f.isRefinedDiagnosis} reasoning=${f.hasRefinementReasoning}` : 'ref:—',
    ].join(' ')
  );
}
console.log(`\nSaved → ${path.join(outDir, `${label}.json`)}`);
