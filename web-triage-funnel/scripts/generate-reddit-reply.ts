import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Configuration ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkiqnjhuutcnzauhyyqs.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_sPEsS8NAWyR3-8GSo7Smvw_q7WEqz9B';
const ANALYZE_ENDPOINT = `${SUPABASE_URL}/functions/v1/analyze-symptom`;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("❌ Missing GEMINI_API_KEY in environment variables.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error("ℹ️ Usage: npx tsx scripts/generate-reddit-reply.ts \"<reddit post text>\"");
        process.exit(1);
    }
    const redditPost = args.join(' ');
    console.log(`\n--- Input Received ---\n"${redditPost}"\n----------------------\n`);

    try {
        console.log("🔍 Extracting pet info...");
        // Fast LLM call to extract basic pet demographic info
        const extractModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const extractPrompt = `
        Analyze the following Reddit post and extract the animal species (Dog or Cat). 
        Return ONLY valid JSON. If you cannot determine the species, default to "Unknown Animal".
        { "species": "string" }
        Post: "${redditPost}"
        `;
        const extractResult = await extractModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: extractPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        
        let petData = { species: "Unknown Animal" };
        try {
            petData = JSON.parse(extractResult.response.text());
        } catch (e) {
            console.log("⚠️ Could not parse pet data, using default.");
        }
        
        console.log(`🐾 Detected Species: ${petData.species}`);

        console.log("\n🏥 Querying Triage Edge Function...");
        const initialRes = await fetch(ANALYZE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ANON_KEY}`
            },
            body: JSON.stringify({
                pet: petData,
                symptom: redditPost,
                imageBase64: null
            })
        });

        const triageData = await initialRes.json();
        
        if (!initialRes.ok || triageData.error) {
            console.error("❌ Edge function returned an error:", triageData);
            process.exit(1);
        }

        console.log("✅ Triage complete. Generating human-sounding Reddit reply...");

        // Extract important variables
        const causes = triageData.causes || [];
        const urgencyLevel = triageData.urgencyLevel || "Unknown";
        const immediateAid = triageData.triage_strategy?.immediate_aid || triageData.recommendations || [];
        const verificationQuestions = triageData.verification_questions || [];

        const replyModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const replyPrompt = `
        You are an AI veterinary assistant generating a helpful, compassionate, and informative reply to a Reddit post about a sick pet.
        
        Here is the original Reddit post: "${redditPost}"
        
        Here is the structured triage analysis from our medical engine:
        - Most Likely Causes: ${causes.map((c: any) => c.condition).join(', ')}
        - Urgency Level: ${urgencyLevel.toUpperCase()}
        - Recommended Next Steps: ${immediateAid.join(', ')}
        
        Because we are replying on a forum, we cannot ask the user follow-up questions to clarify the diagnosis.
        Instead, our engine generated these verification questions which we MUST convert into "Red flags to watch out for":
        ${verificationQuestions.map((q: any) => "- " + q.text).join('\n')}
        
        INSTRUCTIONS:
        1. Start with a compassionate and helpful tone recognizing their situation.
        2. Give a polite disclaimer that you are an AI assistant and this is not a substitute for professional veterinary care.
        3. Clearly state the potential causes based on the description.
        4. State the urgency level clearly. If it's an EMERGENCY/CRITICAL/URGENT, emphasize that they should go to an ER or vet immediately.
        5. Provide the immediate next steps (based on the provided array).
        6. EXTREMELY IMPORTANT: Incorporate the verification questions as "Red Flags to watch out for". Instruct the user that if any of these red flags are present, the situation is much more serious and requires immediate attention.
        7. Format this clearly using markdown, bullet points, and bold text for readability on Reddit.
        8. DO NOT write "Here is the response" or anything before the actual comment text. Output exactly the text that should be posted on Reddit.
        `;

        const generationResult = await replyModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: replyPrompt }] }]
        });

        console.log(`\n================ FINAL REDDIT REPLY ================\n`);
        console.log(generationResult.response.text());
        console.log(`\n====================================================\n`);

    } catch (err: any) {
        console.error("❌ An error occurred:", err.message);
    }
}

main();
