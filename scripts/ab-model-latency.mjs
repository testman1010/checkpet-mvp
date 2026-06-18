#!/usr/bin/env node
/**
 * A/B latency comparison of two Gemini models on BYTE-IDENTICAL inputs.
 *
 * Calls the Gemini REST API directly (not the edge function), so it isolates raw
 * model latency from the RAG / edge-runtime overhead. Same prompt, same generationConfig
 * for both models; runs are interleaved (A,B,A,B,...) to average out server-load drift.
 *
 * Reads GEMINI_API_KEY from ../web-triage-funnel/.env.local (or the env var).
 *
 * Usage:
 *   node scripts/ab-model-latency.mjs                                   # 3 runs each, default 2 models
 *   node scripts/ab-model-latency.mjs 5                                 # 5 runs each
 *   node scripts/ab-model-latency.mjs 4 gemini-3.5-flash gemini-3-flash-preview
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  const out = {};
  let raw;
  try { raw = readFileSync(path, "utf8"); } catch { return out; }
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
const fileEnv = loadEnvFile(envPath);
const API_KEY = process.env.GEMINI_API_KEY || fileEnv.GEMINI_API_KEY;
if (!API_KEY) {
  console.error(`Missing GEMINI_API_KEY (checked env + ${envPath})`);
  process.exit(1);
}

// --- args ---
const args = process.argv.slice(2);
let runs = 3;
let models = ["gemini-3.5-flash", "gemini-3-flash-preview"];
if (args.length) {
  if (/^\d+$/.test(args[0])) { runs = parseInt(args[0], 10); if (args.length > 1) models = args.slice(1); }
  else { models = args; }
}

// Representative triage prompt — identical for every model so output size is comparable to the
// production core+detail generation (this is what dominates wall-time).
const PROMPT = `You are an advanced veterinary triage AI. Analyze this case for a dog named Buddy.

CASE: "My dog has been vomiting twice since this morning and seems more tired than usual."
PET: Golden Retriever, 4 years old, ~65 lbs, active.

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
  "conversion_hooks": { "complication_risk_badge": string, "locked_categories": [{ "title": string, "subtitle": string }], "redFlagChecklist": [{ "question": string, "riskIfConfirmed": string }] },
  "detailedAnalysis": { "feeding": { "recommendations": string[] }, "exercise": { "activities": string[] }, "grooming": { "tasks": string[] }, "health": { "monitoring": string[], "preventive_care": string[] } },
  "verification_questions": [{ "id": string, "text": string, "riskWeight": number }],
  "conditional_assessment": string,
  "watch_for_symptoms": string[]
}
Return ONLY the JSON object.`;

const generationConfig = { maxOutputTokens: 12000, temperature: 0.4, responseMimeType: "application/json" };
const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

async function callModel(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
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
    const text = await res.text();
    const ms = performance.now() - start;
    let body; try { body = JSON.parse(text); } catch { body = { _raw: text.slice(0, 300) }; }
    if (!res.ok) {
      return { ms, ok: false, error: body?.error?.message || `HTTP ${res.status}`, status: res.status };
    }
    const u = body.usageMetadata || {};
    return {
      ms, ok: true,
      out: u.candidatesTokenCount ?? null,
      thoughts: u.thoughtsTokenCount ?? null, // present for "thinking" models
      prompt: u.promptTokenCount ?? null,
    };
  } catch (e) {
    return { ms: performance.now() - start, ok: false, error: e?.name === "AbortError" ? "timeout >90s" : e?.message };
  } finally {
    clearTimeout(timer);
  }
}

const stats = Object.fromEntries(models.map((m) => [m, []]));

console.log(`A/B latency — ${runs} runs each, interleaved\nmodels: ${models.join(", ")}\n`);

for (let i = 1; i <= runs; i++) {
  for (const model of models) {
    const r = await callModel(model);
    if (r.ok) {
      stats[model].push(r);
      const extra = [r.out != null ? `${r.out} out` : null, r.thoughts != null ? `${r.thoughts} thinking` : null]
        .filter(Boolean).join(", ");
      console.log(`  [run ${i}] ${model.padEnd(24)} ${(r.ms / 1000).toFixed(2)}s${extra ? `  (${extra} tok)` : ""}`);
    } else {
      console.log(`  [run ${i}] ${model.padEnd(24)} FAILED — ${r.error}`);
    }
  }
}

console.log("\nSummary:");
for (const model of models) {
  const s = stats[model];
  if (!s.length) { console.log(`  ${model.padEnd(24)} no successful runs`); continue; }
  const t = s.map((x) => x.ms);
  const min = Math.min(...t) / 1000, max = Math.max(...t) / 1000, avg = t.reduce((a, b) => a + b, 0) / t.length / 1000;
  const outs = s.map((x) => x.out).filter((x) => x != null);
  const avgOut = outs.length ? Math.round(outs.reduce((a, b) => a + b, 0) / outs.length) : "n/a";
  const ths = s.map((x) => x.thoughts).filter((x) => x != null);
  const avgTh = ths.length ? Math.round(ths.reduce((a, b) => a + b, 0) / ths.length) : "n/a";
  console.log(`  ${model.padEnd(24)} min ${min.toFixed(2)}s | avg ${avg.toFixed(2)}s | max ${max.toFixed(2)}s  (avg ${avgOut} out tok, ${avgTh} thinking tok)`);
}
