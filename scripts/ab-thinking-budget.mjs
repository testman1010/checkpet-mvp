#!/usr/bin/env node
/**
 * A/B latency vs. THINKING BUDGET for gemini-3.5-flash, with a response-quality guardrail.
 *
 * Sends an identical triage prompt at several thinkingBudget settings and reports latency +
 * thinking/output tokens, plus quality signals (valid JSON? finishReason clean? urgency level,
 * #causes, all causes have reasoning?). The full response for each budget's first run is saved
 * to /tmp/tb_<case>_<budget>.json so the actual diagnostic content can be reviewed.
 *
 * Reads GEMINI_API_KEY from ../web-triage-funnel/.env.local (or env).
 *
 * Usage:
 *   node scripts/ab-thinking-budget.mjs                       # moderate case, 3 runs, default budgets
 *   node scripts/ab-thinking-budget.mjs 3 emergency           # emergency case
 *   node scripts/ab-thinking-budget.mjs 3 moderate 1024 512 0 # custom budgets
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  const out = {};
  let raw; try { raw = readFileSync(path, "utf8"); } catch { return out; }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const envPath = process.env.GEMINI_ENV_FILE || join(__dirname, "..", "web-triage-funnel", ".env.local");
const API_KEY = process.env.GEMINI_API_KEY || loadEnvFile(envPath).GEMINI_API_KEY;
if (!API_KEY) { console.error(`Missing GEMINI_API_KEY (checked env + ${envPath})`); process.exit(1); }

const MODEL = "gemini-3.5-flash";

const CASES = {
  moderate: {
    text: "My dog has been vomiting twice since this morning and seems more tired than usual.",
    pet: "Golden Retriever, 4 years old, ~65 lbs, active.",
    expect: "CONSULT/URGENT-ish, not an emergency",
  },
  emergency: {
    text: "My dog suddenly collapsed, is breathing in a labored, gasping way, and his gums look pale and bluish.",
    pet: "Golden Retriever, 4 years old, ~65 lbs, active.",
    expect: "CRITICAL — must escalate immediately",
  },
};

// --- args ---
const args = process.argv.slice(2);
let runs = 3;
let caseKey = "moderate";
let budgets = [null, 512, 128, 0]; // null = model default (no thinkingConfig)
const positional = args.filter((a) => true);
if (positional.length) {
  let rest = [...positional];
  if (/^\d+$/.test(rest[0])) { runs = parseInt(rest.shift(), 10); }
  if (rest[0] && CASES[rest[0]]) { caseKey = rest.shift(); }
  if (rest.length) budgets = rest.map((b) => (b.toLowerCase() === "null" || b.toLowerCase() === "default" ? null : parseInt(b, 10)));
}
const testCase = CASES[caseKey];

const PROMPT = `You are an advanced veterinary triage AI. Analyze this case.

CASE: "${testCase.text}"
PET: ${testCase.pet}

Produce a thorough triage assessment. Respond ONLY in valid JSON with this structure:
{
  "assessmentPossible": boolean,
  "quickInsight": string,
  "keyObservations": string[],
  "primaryRecommendation": string,
  "urgencyLevel": "CRITICAL" | "URGENT" | "CONSULT" | "WATCH" | "NORMAL",
  "confidenceScore": number,
  "causes": [{ "condition": string, "probability": number, "urgency": string, "reasoning": string, "system_category": string }],
  "detectedSystems": string[],
  "triage_strategy": { "immediate_aid": string[], "recovery_protocol": string[] },
  "detailedAnalysis": { "feeding": { "recommendations": string[] }, "exercise": { "activities": string[] }, "grooming": { "tasks": string[] }, "health": { "monitoring": string[], "preventive_care": string[] } },
  "verification_questions": [{ "id": string, "text": string, "riskWeight": number }],
  "conditional_assessment": string,
  "watch_for_symptoms": string[]
}
Return ONLY the JSON object.`;

const baseGenConfig = { maxOutputTokens: 12000, temperature: 0.4, responseMimeType: "application/json" };
const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

const label = (b) => (b === null ? "default" : `budget=${b}`);

async function callWithBudget(budget) {
  const generationConfig = { ...baseGenConfig };
  if (budget !== null) generationConfig.thinkingConfig = { thinkingBudget: budget };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: PROMPT }] }], generationConfig, safetySettings }),
      signal: controller.signal,
    });
    const raw = await res.text();
    const ms = performance.now() - start;
    let body; try { body = JSON.parse(raw); } catch { body = null; }
    if (!res.ok) return { ms, ok: false, error: body?.error?.message || `HTTP ${res.status}` };

    const u = body.usageMetadata || {};
    const cand = body.candidates?.[0];
    const finish = cand?.finishReason;
    const outText = cand?.content?.parts?.map((p) => p.text || "").join("") || "";

    // quality signals
    let parsed = null, jsonValid = false;
    try { parsed = JSON.parse(outText); jsonValid = true; } catch {}
    const causes = parsed?.causes || [];
    const allCausesReasoned = causes.length > 0 && causes.every((c) => c.reasoning && c.reasoning.trim().length > 10);

    return {
      ms, ok: true,
      out: u.candidatesTokenCount ?? null,
      thoughts: u.thoughtsTokenCount ?? null,
      finish,
      jsonValid,
      urgency: parsed?.urgencyLevel ?? "(none)",
      nCauses: causes.length,
      allCausesReasoned,
      immediateAid: parsed?.triage_strategy?.immediate_aid?.length ?? 0,
      confidence: parsed?.confidenceScore ?? null,
      outText,
    };
  } catch (e) {
    return { ms: performance.now() - start, ok: false, error: e?.name === "AbortError" ? "timeout >90s" : e?.message };
  } finally {
    clearTimeout(timer);
  }
}

const stats = Object.fromEntries(budgets.map((b) => [String(b), []]));
const saved = new Set();

console.log(`THINKING BUDGET A/B — model ${MODEL}\ncase: ${caseKey} (expect: ${testCase.expect})\nruns: ${runs} | budgets: ${budgets.map(label).join(", ")}\n`);

for (let i = 1; i <= runs; i++) {
  for (const b of budgets) {
    const r = await callWithBudget(b);
    if (!r.ok) { console.log(`  [run ${i}] ${label(b).padEnd(12)} FAILED — ${r.error}`); continue; }
    stats[String(b)].push(r);
    if (!saved.has(String(b))) {
      const f = `/tmp/tb_${caseKey}_${b === null ? "default" : b}.json`;
      writeFileSync(f, r.outText || "");
      saved.add(String(b));
    }
    const flags = [
      r.jsonValid ? "json✓" : "json✗",
      r.finish === "STOP" ? "stop✓" : `finish=${r.finish}`,
      `urg=${r.urgency}`,
      `causes=${r.nCauses}${r.allCausesReasoned ? "✓" : "✗"}`,
    ].join(" ");
    console.log(`  [run ${i}] ${label(b).padEnd(12)} ${(r.ms / 1000).toFixed(2)}s  ${String(r.thoughts ?? "?").padStart(4)} think / ${String(r.out ?? "?").padStart(4)} out tok   ${flags}`);
  }
}

console.log("\nSummary (latency):");
for (const b of budgets) {
  const s = stats[String(b)];
  if (!s.length) { console.log(`  ${label(b).padEnd(12)} no successful runs`); continue; }
  const t = s.map((x) => x.ms);
  const min = Math.min(...t) / 1000, max = Math.max(...t) / 1000, avg = t.reduce((a, c) => a + c, 0) / t.length / 1000;
  const avgTh = Math.round(s.reduce((a, c) => a + (c.thoughts || 0), 0) / s.length);
  const urg = [...new Set(s.map((x) => x.urgency))].join("/");
  const allValid = s.every((x) => x.jsonValid && x.finish === "STOP");
  console.log(`  ${label(b).padEnd(12)} avg ${avg.toFixed(2)}s (min ${min.toFixed(2)} / max ${max.toFixed(2)})  ~${avgTh} think tok  urgency=${urg}  ${allValid ? "all valid✓" : "QUALITY FLAG✗"}`);
}
console.log(`\nFull responses saved to /tmp/tb_${caseKey}_*.json for quality review.`);
