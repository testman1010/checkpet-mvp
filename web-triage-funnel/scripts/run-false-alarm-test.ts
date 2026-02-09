
// import 'dotenv/config'; // Removed to avoid dependency issues, using hardcoded fallbacks or process.env if available
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkiqnjhuutcnzauhyyqs.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sPEsS8NAWyR3-8GSo7Smvw_q7WEqz9B';
const ANALYZE_ENDPOINT = `${SUPABASE_URL}/functions/v1/analyze-symptom`;

interface TestCase {
    id: string;
    pet: {
        species: string;
        breed?: string;
        age_desc?: string; // "3yrs", "Puppy", "Adult"
        weight_desc?: string; // "50kg", "5kg", "20kg"
        sex?: string;
        neutered_status?: string; // "Neutered", "Intact"
    };
    symptom: string;
    image_desc?: string; // For console log context
    trap: string;
    ground_truth: string;
    expected_urgency: string; // CRITICAL, URGENT, CONSULT, WATCH, NORMAL
}

const TEST_CASES: TestCase[] = [
    // --- BENIGN: Loud / Scary Sounds ---
    {
        id: '01-ReverseSneezing',
        pet: { species: 'Dog', breed: 'Pug', age_desc: 'Adult' },
        symptom: 'Making a horrible honking sound, looks like he can\'t breathe! Spasming.',
        trap: 'Diagnosing "Choking" or "Respiratory Distress" (Over-reaction to honk).',
        ground_truth: 'Reverse Sneezing',
        expected_urgency: 'WATCH'
    },
    {
        id: '02-GooseHonk',
        pet: { species: 'Dog', breed: 'Yorkie', age_desc: 'Adult' },
        symptom: 'Coughing like a goose honk when pulling on leash.',
        trap: 'Diagnosing "Heart Failure" or "Pneumonia" instead of Tracheal Collapse (chronic vs acute).',
        ground_truth: 'Tracheal Collapse (Mild/Chronic)',
        expected_urgency: 'CONSULT' // Start with consult, not panic.
    },
    {
        id: '03-CatZoomies',
        pet: { species: 'Cat', age_desc: 'Young Adult' },
        symptom: 'Running around the house like crazy, eyes wide, meowing loudly at 2am.',
        trap: 'Diagnosing "Rabies" or "Seizure" or "Hyperthyroidism".',
        ground_truth: 'Zoomies (FRAP)',
        expected_urgency: 'NORMAL'
    },

    // --- BENIGN: "Gross" but Safe ---
    {
        id: '04-EatingGrass',
        pet: { species: 'Dog', age_desc: 'Adult' },
        symptom: 'Ate a bunch of grass and vomited a little yellow foam. Acting fine now.',
        trap: 'Diagnosing "Poisoning" or "Obstruction".',
        ground_truth: 'Bilious Vomiting Syndrome / Dietary Indiscretion (Mild)',
        expected_urgency: 'WATCH'
    },
    {
        id: '05-Coprophagia',
        pet: { species: 'Dog', age_desc: 'Puppy' },
        symptom: 'Ate his own poop. Disgusting!',
        trap: 'Diagnosing "Nutritional Deficiency" as urgent.',
        ground_truth: 'Coprophagia (Behavioral)',
        expected_urgency: 'NORMAL'
    },

    // --- BENIGN: Transient Symptoms ---
    {
        id: '06-PuppyHiccups',
        pet: { species: 'Dog', age_desc: 'Puppy' },
        symptom: 'Hiccuping for 10 minutes straight after eating.',
        trap: 'Diagnosing "Bloat" or "Volvulus".',
        ground_truth: 'Hiccups',
        expected_urgency: 'NORMAL'
    },
    {
        id: '07-PostOpGrogginess',
        pet: { species: 'Cat', age_desc: 'Adult' },
        symptom: 'Had dental surgery this morning. Is very sleepy and won\'t play.',
        trap: 'Diagnosing "Complication" or "Shock".',
        ground_truth: 'Normal Post-Anesthesia Recovery',
        expected_urgency: 'WATCH'
    },

    // --- BENIGN: Visual Scares ---
    {
        id: '08-CherryEye',
        pet: { species: 'Dog', breed: 'Bulldog', age_desc: 'Puppy' },
        symptom: 'Red lump appeared in corner of eye. Not painful.',
        trap: 'Diagnosing "Tumor" or "Emergency Glaucoma".',
        ground_truth: 'Cherry Eye (Prolapsed Gland)',
        expected_urgency: 'CONSULT' // Ugly but not urgent.
    },
    {
        id: '09-Lipoma',
        pet: { species: 'Dog', age_desc: 'Senior', breed: 'Labrador' },
        symptom: 'Found a soft, squishy lump on his flank. Moves under skin. Doesn\'t hurt.',
        trap: 'Diagnosing "Cancer/Sarcoma" immediately.',
        ground_truth: 'Lipoma (Fatty Tumor)',
        expected_urgency: 'CONSULT'
    },

    // --- BENIGN: Behavioral ---
    {
        id: '10-Monting', // "Humping"
        pet: { species: 'Dog', age_desc: 'Puppy', sex: 'Female' },
        symptom: 'Humping other dogs at the park.',
        trap: 'Diagnosing "UTI" or "Hormonal Imbalance" as urgent.',
        ground_truth: 'Play Behavior / Dominance',
        expected_urgency: 'NORMAL'
    }
];

// --- Helper Functions ---

function parseAge(desc?: string): { years: number, months: number } {
    if (!desc) return { years: 0, months: 0 };
    const d = desc.toLowerCase();
    if (d.includes('puppy')) return { years: 0, months: 4 };
    if (d.includes('kitten')) return { years: 0, months: 4 };
    if (d.includes('adult')) return { years: 4, months: 0 };
    if (d.includes('senior')) return { years: 11, months: 0 };

    const yearsMatch = d.match(/(\d+)\s*yr/);
    if (yearsMatch) return { years: parseInt(yearsMatch[1]), months: 0 };

    const wksMatch = d.match(/(\d+)\s*wk/);
    if (wksMatch) return { years: 0, months: Math.floor(parseInt(wksMatch[1]) / 4) };

    return { years: 2, months: 0 }; // Default
}

function parseWeight(desc?: string): number {
    if (!desc) return 0;
    const match = desc.match(/(\d+)\s*(kg|lb)/i);
    if (match) {
        const val = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        return unit === 'kg' ? val * 2.2 : val;
    }
    return 0;
}

// --- Main Test Logic ---

async function runTest(testCase: TestCase) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`Case ID: ${testCase.id} | Ground Truth: ${testCase.ground_truth}`);
    console.log(`Input: "${testCase.symptom}"`);
    console.log(`Trap: ${testCase.trap}`);

    // 1. Initial Analysis
    const petData = {
        species: testCase.pet.species,
        breed: testCase.pet.breed || 'Unknown',
        sex: testCase.pet.sex || 'Unknown',
        neutered: testCase.pet.neutered_status === 'Neutered',
        age_years: parseAge(testCase.pet.age_desc).years,
        age_months: parseAge(testCase.pet.age_desc).months,
        weight_lbs: parseWeight(testCase.pet.weight_desc),
        weight_description: testCase.pet.weight_desc || ''
    };

    console.log(`... Sending Initial Analytics Request ...`);

    try {
        const initialRes = await fetch(ANALYZE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ANON_KEY}`
            },
            body: JSON.stringify({
                pet: petData,
                symptom: testCase.symptom,
                imageBase64: null // Cannot easily simulate image in script without local file, using text overrides
            })
        });

        const initialData = await initialRes.json();
        if (!initialData.verification_questions) {
            console.error("❌ Failed to get verification questions:", initialData);
            return;
        }

        console.log(`received ${initialData.verification_questions.length} questions.`);

        // 2. Simulate User Answers (Heuristic: "Yes" to severe/matching symptoms)
        // We assume the GROUND TRUTH is the reality.
        // If Question asks "Is X happening?" and X is a symptom of Ground Truth, answer "Yes".
        // This requires semantic understanding, but for "Torture Test", we can default to "Yes" 
        // for symptoms that *confirm* the Ground Truth to see if the AI *recognizes* them.
        // For "False Alarm" cases, we should answer "No" to severe symptoms (e.g. "Is gum pale?").

        // Heuristic:
        // If Urgency is CRITICAL/URGENT -> Default "Yes" to risk questions (assuming they are relevant).
        // If Urgency is NORMAL/WATCH -> Default "No" to risk questions.
        // Exception: Explicit symptoms in Ground Truth (e.g. "Bloat" -> Yes to "Hard belly").

        const simulatedAnswers = initialData.verification_questions.map((q: any) => {
            // Simple keyword check against Ground Truth
            const gt = testCase.ground_truth.toLowerCase();
            const qText = q.text.toLowerCase();

            // Critical Logic
            if (testCase.expected_urgency === 'CRITICAL' || testCase.expected_urgency === 'URGENT') {
                // For Bloat
                if (gt.includes('bloat') && (qText.includes('hard') || qText.includes('distended') || qText.includes('retch'))) return { question: q.text, answer: "Yes" };
                // For Blocked Tom
                if (gt.includes('blocked') && (qText.includes('strain') || qText.includes('pain') || qText.includes('urine'))) return { question: q.text, answer: "Yes" };
                // For Toxin
                if (gt.includes('toxin') && (qText.includes('eat') || qText.includes('vomit'))) return { question: q.text, answer: "Yes" };
                // For Pyometra
                if (gt.includes('pyometra') && (qText.includes('discharge') || qText.includes('drink') || qText.includes('heat'))) return { question: q.text, answer: "Yes" };
                // For Pale Gums
                if (gt.includes('hypoglycemia') && (qText.includes('gum') || qText.includes('pale') || qText.includes('eat'))) return { question: q.text, answer: "Yes" };

                // Default fallback for critical: Unsure (Safety)
                return { question: q.text, answer: "Unsure" };
            } else {
                // Low Urgency -> Answer "No" to severe questions usually
                return { question: q.text, answer: "No" };
            }
        });

        console.log(`... Simulating Answers:`, simulatedAnswers.map((a: any) => `${a.question} -> ${a.answer}`));

        // 3. Refinement Analytics
        const refinementRes = await fetch(ANALYZE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ANON_KEY}`
            },
            body: JSON.stringify({
                pet: petData,
                symptom: testCase.symptom,
                refinedSymptoms: simulatedAnswers.filter((a: any) => a.answer === 'Yes').map((a: any) => a.question), // Mock refined tags
                initialCauses: initialData.causes,
                refinementContext: simulatedAnswers
            })
        });

        const finalData = await refinementRes.json();

        // 4. Report
        console.log(`\n---> FINAL DIAGNOSIS: ${finalData.causes?.[0]?.condition || 'Unknown'}`);
        console.log(`---> URGENCY: ${finalData.urgencyLevel}`);
        console.log(`---> CONFIDENCE: ${finalData.confidenceScore || (finalData.causes?.[0]?.probability * 100).toFixed(0)}%`);
        console.log(`---> REASONING: ${finalData.refinement_reasoning}`);

        // Pass Criteria
        // Map Expected (CRITICAL) to Normalized (emergency)
        const normalizedExpected = testCase.expected_urgency.toLowerCase() === 'critical' ? 'emergency' :
            testCase.expected_urgency.toLowerCase() === 'urgent' ? 'urgent' :
                testCase.expected_urgency.toLowerCase() === 'consult' ? 'vet_visit_needed' :
                    testCase.expected_urgency.toLowerCase() === 'watch' ? 'monitor' : 'normal';

        const urgencyMatch = finalData.urgencyLevel === normalizedExpected ||
            (normalizedExpected === 'urgent' && finalData.urgencyLevel === 'emergency') ||
            (normalizedExpected === 'vet_visit_needed' && finalData.urgencyLevel === 'urgent'); // Allow conservative overlap

        const diagnosisMatch = finalData.causes?.[0]?.condition?.toLowerCase().includes(testCase.ground_truth.split('/')[0].toLowerCase().trim());

        if (urgencyMatch) {
            console.log(`✅ MATCH: Urgency Level Correct (${finalData.urgencyLevel})`);
        } else {
            console.log(`❌ FAIL: Urgency Mismatch. Expected ${testCase.expected_urgency}, Got ${finalData.urgencyLevel}`);
        }

    } catch (err: any) {
        console.error("Error running test case:", err.message);
    }
}

async function start() {
    console.log("Starting Triage Torture Test Suite...");
    for (const testCase of TEST_CASES) {
        await runTest(testCase);
        // Wait 2s to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
}

start();
