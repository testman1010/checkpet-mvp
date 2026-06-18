#!/usr/bin/env node
/**
 * Smoke-test + latency timer for the `analyze-symptom` Supabase edge function.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * ../web-triage-funnel/.env.local (no secrets hardcoded), sends a realistic
 * triage payload, and prints the end-to-end latency + a summary of the result.
 *
 * Usage:
 *   node scripts/test-analyze-symptom.mjs                 # 1 run, default symptom
 *   node scripts/test-analyze-symptom.mjs 5               # 5 runs, show min/avg/max
 *   node scripts/test-analyze-symptom.mjs 3 "limping on front left leg"
 *   node scripts/test-analyze-symptom.mjs --json          # dump full raw JSON response
 *
 * Override the env file with SUPABASE_ENV_FILE=/path/to/.env, or set
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY directly.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load env (.env.local) without extra deps ---
function loadEnvFile(path) {
  const out = {};
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out; // missing file is fine; we fall back to process.env
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

const envPath =
  process.env.SUPABASE_ENV_FILE ||
  join(__dirname, "..", "web-triage-funnel", ".env.local");
const fileEnv = loadEnvFile(envPath);

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    `Missing Supabase URL / anon key. Looked in env vars and: ${envPath}`
  );
  process.exit(1);
}

const FN_URL = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/analyze-symptom`;
const TIMEOUT_MS = 90_000;

// --- Parse args ---
const args = process.argv.slice(2);
const dumpJson = args.includes("--json");
const positional = args.filter((a) => !a.startsWith("--"));
let runs = 1;
let symptom =
  "My dog has been vomiting twice since this morning and seems more tired than usual.";
if (positional.length) {
  if (/^\d+$/.test(positional[0])) {
    runs = parseInt(positional[0], 10);
    if (positional.length > 1) symptom = positional.slice(1).join(" ");
  } else {
    symptom = positional.join(" ");
  }
}

const payload = {
  symptom,
  pet: {
    name: "Buddy",
    species: "Dog",
    breed: "Golden Retriever",
    age_years: 4,
    weight_lbs: 65,
    activity_level: "Active",
  },
  // standard triage (not refinement / not monitoring)
  refinedSymptoms: [],
  initialCauses: [],
  refinementContext: [],
};

async function callOnce() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    const ms = performance.now() - start;
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { _unparsed: text.slice(0, 500) };
    }
    return { ms, httpStatus: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function summarize(body) {
  // The function returns HTTP 200 even on failure; detect app-level errors.
  if (body.error || body.assessmentPossible === false) {
    return `   ⚠️  app error: ${body.failureReason || body.error || "unknown"}`;
  }
  const lines = [];
  lines.push(`   urgency:    ${body.urgencyLevel ?? "(none)"}`);
  const insight = body.summary || body.quickInsight;
  if (insight) lines.push(`   insight:    ${String(insight).slice(0, 120)}`);
  if (Array.isArray(body.causes) && body.causes.length) {
    const top = body.causes
      .slice(0, 3)
      .map((c) => {
        if (c.probability == null) return c.condition;
        // Backend is inconsistent: sometimes 0-1 fraction, sometimes 0-100 percent.
        const pct = c.probability <= 1 ? c.probability * 100 : c.probability;
        return `${c.condition} (${Math.round(pct)}%)`;
      })
      .join(", ");
    lines.push(`   top causes: ${top}`);
  }
  if (body.confidenceScore != null)
    lines.push(`   confidence: ${body.confidenceScore}`);
  if (Array.isArray(body.citations))
    lines.push(`   citations:  ${body.citations.length}`);
  return lines.join("\n");
}

console.log(`POST ${FN_URL}`);
console.log(`symptom: "${symptom}"`);
console.log(`runs: ${runs}\n`);

const timings = [];
for (let i = 1; i <= runs; i++) {
  try {
    const { ms, httpStatus, body } = await callOnce();
    timings.push(ms);
    console.log(
      `Run ${i}/${runs}: HTTP ${httpStatus} in ${(ms / 1000).toFixed(2)}s`
    );
    if (dumpJson) {
      console.log(JSON.stringify(body, null, 2));
    } else {
      console.log(summarize(body));
    }
    console.log("");
  } catch (err) {
    const reason = err?.name === "AbortError" ? `timeout >${TIMEOUT_MS}ms` : err?.message;
    console.log(`Run ${i}/${runs}: FAILED — ${reason}\n`);
  }
}

if (timings.length > 1) {
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  console.log(
    `Latency over ${timings.length} successful runs — ` +
      `min ${(min / 1000).toFixed(2)}s | avg ${(avg / 1000).toFixed(2)}s | max ${(max / 1000).toFixed(2)}s`
  );
}
