import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function testLiveEdgeFunction() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        console.error("Missing Supabase credentials in .env.local");
        return;
    }

    // A non-obvious example: Xylitol toxicity hidden behind "sugar-free gum" 
    const payload = {
        symptom: "My male cat has been making frequent trips to the litter box for the past 6 hours, but he is only producing tiny drops of urine each time. He is crying intensely when he tries to go.",
        pet: {
            name: "Oliver",
            species: "Cat",
            breed: "Domestic Shorthair",
            weight_lbs: 12
        },
        // We aren't testing refinement mode here, just initial triage
        isRefinementMode: false
    };

    console.log(`=====================================================================`);
    console.log(`Testing Live Analyze-Symptom Function`);
    console.log(`Endpoint: ${supabaseUrl}/functions/v1/analyze-symptom`);
    console.log(`Symptom Payload: "${payload.symptom}"`);
    console.log(`=====================================================================\n`);

    console.log("Sending POST request...");
    const startTime = performance.now();

    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze-symptom`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify(payload)
        });

        const endTime = performance.now();
        const durationMs = (endTime - startTime).toFixed(0);

        console.log(`Response Status: ${response.status} ${response.statusText}`);
        console.log(`Performance: ${durationMs}ms\n`);

        const data = await response.json();

        console.log("== TRIAGE OUTPUT ==");
        console.log(`Urgency: ${data.urgencyLevel}`);
        console.log(`Recommendation: ${data.primaryRecommendation}`);
        console.log(`\n== TOP DIAGNOSES ==`);
        if (data.causes) {
            data.causes.forEach((c, i) => {
                console.log(`[${i + 1}] ${c.condition} (${c.probability}%)`);
                console.log(`    Category: ${c.system_category || 'Unknown'}`);
            });
        }

        console.log(`\n== RAG CITATIONS USED ==`);
        if (data.citations && data.citations.length > 0) {
            data.citations.forEach((cit, i) => {
                console.log(`[${i + 1}] ${cit}`);
            });
        } else {
            console.log("No citations returned in the JSON.");
        }

    } catch (error) {
        console.error("Fetch failed:", error);
    }
}

testLiveEdgeFunction();
