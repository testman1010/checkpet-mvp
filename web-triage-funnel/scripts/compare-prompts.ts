
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// --- MOCK DATA WITH GROUND TRUTH (EMERGENCY EDITION) ---

const TEST_CASES = [
    {
        name: "Case A: The Silent Killer (GDV/Bloat)",
        // AMBIGUOUS INPUT: "Trying to vomit" could be simple gastritis.
        symptom: "My Great Dane is pacing around and trying to throw up but nothing comes out.",
        pet: { species: "Dog", breed: "Great Dane", age: "5 years" },

        // HIDDEN REALITY: EMERGENCY (GDV)
        hiddenCondition: "Gastric Dilatation-Volvulus (GDV)",
        hiddenFacts: {
            "unproductive|nothing|retch|heaving": "YES. He heaves but no vomit appears.",
            "swell|bloat|distend|hard|belly": "YES. His stomach feels tight like a drum.",
            "pain|pace|whine|anxious": "YES. He looks panicked and won't lie down.",
            "poop|diarrhea": "NO. Nothing.",
            "gum|pale|muddy": "YES. Gums look pale."
        },

        context: `[Source: Merck Veterinary Manual]
        Gastritis (Upset Stomach): Common. Vomiting food/bile. Dog is usually stable. Abdomen soft.
        
        Gastric Dilatation-Volvulus (GDV/Bloat): CRITICAL EMERGENCY. Specific to large breeds (Great Dane). Signs: Non-productive retching (trying to vomit nothing), distended/hard abdomen, restlessness/pacing, pale gums, shock.`
    },
    {
        name: "Case B: The Hiding Cat (Blocked Tom)",
        // AMBIGUOUS INPUT: "Lying in litter box" could be constipation or behavioral.
        symptom: "My male cat is just lying in his litter box and hasn't come out for an hour.",
        pet: { species: "Cat", sex: "Male", age: "4 years" },

        // HIDDEN REALITY: EMERGENCY (Urethral Obstruction)
        hiddenCondition: "Urethral Obstruction",
        hiddenFacts: {
            "strain|push|try|attempt": "YES. I saw him straining earlier.",
            "urine|pee|wet|clump": "NO. The litter is dry.",
            "pain|cry|yowl|vocal": "YES. He growls if I touch his belly.",
            "eat|food": "NO. Refused dinner.",
            "vomit": "YES. Vomited white foam once."
        },

        context: `[Source: Merck Veterinary Manual]
        Constipation: Straining to defecate. Hard stool in colon. Bladder small/soft.
        
        Feline Urethral Obstruction (Blocked Tom): CRITICAL EMERGENCY. Male cats. Signs: Lying in litter box, straining to urinate with NO production, vocalizing in pain, hard/painful bladder, vomiting.`
    },
    {
        name: "Case C: The Flower Eater (Lily Toxicity)",
        // AMBIGUOUS INPUT: "Chewed a flower" could match benign plants.
        symptom: "I found my cat chewing on a flower from my bouquet. She seems fine now.",
        pet: { species: "Cat", age: "2 years" },

        // HIDDEN REALITY: EMERGENCY (Lily Toxicity)
        hiddenCondition: "Lily Toxicity",
        hiddenFacts: {
            "type|name|flower|kind": "It looks like a Stargazer Lily.",
            "vomit|drool|saliva": "YES. She just drooled a bit.",
            "pollen|leaf|petal": "YES. There is orange pollen on her nose.",
            "fine|normal|act": "She seems tired now."
        },

        context: `[Source: Merck Veterinary Manual]
        Non-Toxic Plants (Spider Plant, Rose): Mild GI upset. Vomiting may occur but resolves.
        
        Lily Toxicity (Lilium spp.): FATAL EMERGENCY in cats. Even small amount of pollen/water causes acute kidney failure within 24-72 hours. Early signs: Drooling, vomiting, lethargy. Immediate aggressive treatment required.`
    },
    {
        name: "Case D: The Unsure Owner (Potential Anemia/Bleed)",
        // AMBIGUOUS INPUT: "Weakness" could be anything.
        symptom: "My dog is suddenly very weak and won't stand up.",
        pet: { species: "Dog", age: "7 years" },

        // HIDDEN REALITY: EMERGENCY (Internal Bleeding/Hemoabdomen)
        hiddenCondition: "Hemoabdomen",
        hiddenFacts: {
            "gum|pale|white|color": "Unsure. I can't really tell.", // CRITICAL UNSURE
            "belly|distend|bloat": "Yes. It feels a bit full.",
            "pain": "Unsure. He's just panting.",
            "eat|food": "No."
        },

        context: `[Source: Merck Veterinary Manual]
        Arthritis: Chronic pain. Slow rise. Gums pink.
        
        Hemoabdomen (Internal Bleeding): CRITICAL EMERGENCY. Ruptured tumor/spleen. Signs: Sudden collapse, pale/white gums, distended abdomen, panting (pain).`
    }
];

// --- PROMPTS ---

function generateInitialPrompt(caseData: any): string {
    return `You are a veterinary AI.
    Context: ${caseData.context}
    Patient: ${JSON.stringify(caseData.pet)}
    Symptom: "${caseData.symptom}"
    
    Task: Generate strictly 3 Yes/No clarifying questions to distinguish between the dangerous and non-dangerous differentials.
    
    Return JSON: { "questions": ["Q1", "Q2", "Q3"] }`;
}

function generateRefinementPrompt(caseData: any, qaPairs: any[], useNewPrompt: boolean): string {
    const evidenceInstruction = useNewPrompt
        ? `CRITICAL: You MUST support your diagnosis by citing specific evidence. 
           - Quote the EXACT sentence from the Context that matches the user's answers.
           - Format: "User reported [Answer], which matches text: '[Quote]'."`
        : `Cite the provided context to support your diagnosis.`;

    return `You are a veterinary AI.
    Context: ${caseData.context}
    Patient: ${JSON.stringify(caseData.pet)}
    Symptom: "${caseData.symptom}"
    
    Refinement Data (User Answers):
    ${JSON.stringify(qaPairs, null, 2)}
    
    Task: Provide a final diagnosis and reasoning.
    ${evidenceInstruction}
    
    Return JSON: { 
        "diagnosis": "string",
        "urgency": "string",
        "reasoning": "string"
    }`;
}

// --- SIMULATED USER (The Oracle) ---

async function answerQuestions(questions: string[], hiddenFacts: any) {
    console.log("   [User Simulation]: Consulting Hidden Reality (Strict Yes/No)...");
    return questions.map(q => {
        const qLower = q.toLowerCase();
        // Check if the question asks about any of our hidden facts
        for (const [triggers, fact] of Object.entries(hiddenFacts)) {
            const keywords = triggers.split('|');
            if (keywords.some(k => qLower.includes(k))) {
                // Extract "Yes", "No", or "Unsure"
                const factStr = String(fact);
                const factUpper = factStr.toUpperCase();
                let answer = "Unsure";
                if (factUpper.startsWith("YES")) answer = "Yes";
                else if (factUpper.startsWith("NO")) answer = "No";

                return { question: q, answer: answer };
            }
        }
        return { question: q, answer: "Unsure" };
    });
}

// --- RUNNER ---

async function runTest() {
    console.log("Starting Ground Truth Triage Simulation...\n");

    for (const testCase of TEST_CASES) {
        console.log(`\n=== ${testCase.name} ===`);
        console.log(`> Symptom (Ambiguous): "${testCase.symptom}"`);
        console.log(`> Ground Truth (Hidden): ${testCase.hiddenCondition}`);

        // 1. Initial Triage
        console.log("-> Generating Questions...");
        const result1 = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: generateInitialPrompt(testCase) }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const questions = JSON.parse(result1.response.text()).questions;
        console.log("   AI Asked:", questions);

        // 2. Simulate User Answers
        const qaPairs = await answerQuestions(questions, testCase.hiddenFacts);
        console.log("   User Answered:", qaPairs.map(qa => `"${qa.answer}" (to '${qa.question}')`));

        // 3. Baseline Refinement
        const resultBase = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: generateRefinementPrompt(testCase, qaPairs, false) }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const baseResponse = JSON.parse(resultBase.response.text());

        // 4. Proposed Refinement
        const resultNew = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: generateRefinementPrompt(testCase, qaPairs, true) }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const newResponse = JSON.parse(resultNew.response.text());

        // 5. Compare
        console.log("\n   [BASELINE RESULT]");
        console.log(`   Diagnosis: ${baseResponse.diagnosis}`);
        console.log(`   Reasoning: ${baseResponse.reasoning}`);

        console.log("\n   [PROPOSED EVIDENCE-BASED RESULT]");
        console.log(`   Diagnosis: ${newResponse.diagnosis}`);
        console.log(`   Evidence Used: ${newResponse.reasoning}`); // Using reasoning field as evidence summary

        // Simple verification check
        const isCorrect = newResponse.diagnosis.toLowerCase().includes(testCase.hiddenCondition.split('(')[0].trim().toLowerCase());
        console.log(`   >>> MATCHES GROUND TRUTH? ${isCorrect ? "✅ YES" : "❌ NO"}`);

        console.log("-----------------------------------");
    }
}

runTest().catch(console.error);
