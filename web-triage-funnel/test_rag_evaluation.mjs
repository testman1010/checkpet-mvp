import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function retrieveVeterinaryContext(queryText, species) {
    const fastModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const queryPrompt = `
        You are a search optimization agent for a veterinary database.
        Analyze the user's description and "translate" it into strict search parameters.

        SEARCH TARGET: "${queryText}"
        PET SPECIES: "${species}"

        RULES:
        1. "clinical_category": Return up to 3 most relevant categories (e.g., "Dermatology", "Emergency", "Toxicology", "Gastroenterology", "Neurology", "Ophthalmology").
        2. "species": If input is "Dog", return ["Dog", "General", "Unknown"]. If "Cat", return ["Cat", "General", "Unknown"].
        3. "search_query": A short, keyword-dense query optimized for vector similarity.
        
        Return ONLY JSON:
        { "clinical_category": ["string"], "species": ["string"], "search_query": "string" }
    `;

    const queryResult = await fastModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: queryPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    // Parse the generated search parameters
    let queryParams;
    try {
        const text = queryResult.response.text().replace(/```json\n?|\n?```/g, '').trim();
        queryParams = JSON.parse(text);
    } catch (e) {
        return { error: "Failed to parse query params", raw: queryResult.response.text() };
    }

    const performSearch = async (useFilters) => {
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embeddingResult = await embeddingModel.embedContent(queryParams.search_query);

        const rpcParams = {
            query_embedding: embeddingResult.embedding.values.slice(0, 768),
            match_threshold: useFilters ? 0.5 : 0.35,
            match_count: 3 // top 3 for brevity
        };

        if (useFilters) {
            rpcParams.filter = {
                species: [queryParams.species[0]],
                clinical_category: [queryParams.clinical_category[0]]
            };
        }

        const { data: documents, error } = await supabase.rpc('match_merck_v2', rpcParams);
        return { documents, error };
    };

    let searchResults = await performSearch(true);
    let usedFallback = false;

    if (!searchResults.documents || searchResults.documents.length === 0) {
        searchResults = await performSearch(false);
        usedFallback = true;
    }

    return {
        params: queryParams,
        usedFallback,
        results: searchResults.documents || []
    };
}

async function runTests() {
    const testCases = [
        {
            species: "Dog",
            symptom: "My dog's eye is suddenly very cloudy today and he is squinting a lot. It looks almost completely blue.",
            expected: "Glaucoma, Corneal Ulcer, or Uveitis. Needs Ophthalmology."
        },
        {
            species: "Cat",
            symptom: "My 10 year old male indoor cat has been going to the litter box every 10 minutes but nothing comes out. He seems to be straining and crying.",
            expected: "Feline Lower Urinary Tract Disease (FLUTD), Urethral Blockage. CRITICAL Emergency."
        },
        {
            species: "Dog",
            symptom: "My golden retriever has a hot, red, oozing bald patch on his cheek that appeared overnight and he won't stop scratching it.",
            expected: "Hot spot (Pyotraumatic dermatitis). Dermatology."
        },
        {
            species: "Cat",
            symptom: "Every time I pet my cat near the base of her tail, her skin ripples wildly and she suddenly acts aggressive and runs away biting herself.",
            expected: "Feline Hyperesthesia Syndrome. Neurology/Behaviorology."
        },
        {
            species: "Dog",
            symptom: "We live in a wooded area. My dog's back legs suddenly seem very weak today and he can't stand up properly, but he isn't crying in pain.",
            expected: "Tick Paralysis. Neurology/Toxicology."
        },
        {
            species: "Cat",
            symptom: "My elderly cat has been losing weight despite having a ravenous appetite. She is also extremely vocal at night and has diarrhea.",
            expected: "Hyperthyroidism. Endocrinology/GI."
        },
        {
            species: "Dog",
            symptom: "My large deep-chested dog just ate a huge meal, and now he is pacing, drooling heavily, and his stomach looks weirdly puffed out. He keeps trying to vomit but nothing comes up.",
            expected: "GDV (Bloat). CRITICAL Emergency."
        },
        {
            species: "Cat",
            symptom: "My kitten has a black, crusty discharge in both ears that looks like coffee grounds. He is shaking his head constantly.",
            expected: "Ear Mites (Otodectes cynotis). Dermatology/Parasitology."
        },
        {
            species: "Dog",
            symptom: "My dog ate a piece of sugar-free gum that fell on the floor about 30 minutes ago.",
            expected: "Xylitol Toxicity. CRITICAL Emergency/Toxicology."
        },
        {
            species: "Dog",
            symptom: "My older dog has developed a honking cough that sounds exactly like a goose whenever she gets excited or pulls on her leash.",
            expected: "Tracheal Collapse. Respiratory."
        }
    ];

    console.log("=====================================================================");
    console.log(`Running RAG Retrieval Test Suite (${testCases.length} Edge Cases)`);
    console.log("=====================================================================\n");

    for (let i = 0; i < testCases.length; i++) {
        const t = testCases[i];
        console.log(`[TEST ${i + 1}/10] Species: ${t.species}`);
        console.log(`PROMPT: "${t.symptom}"`);
        console.log(`EXPECTED TARGET: ${t.expected}\n`);

        const res = await retrieveVeterinaryContext(t.symptom, t.species);

        console.log(`=> RAG TRANSLATION:`);
        console.log(`   - Query: "${res.params?.search_query}"`);
        console.log(`   - Categories: ${res.params?.clinical_category?.join(', ')}`);
        console.log(`   - Species: ${res.params?.species?.join(', ')}`);

        if (res.usedFallback) {
            console.log(`\n=> ⚠️  STRICT FILTER RETURNED 0 RESULTS. USED FALLBACK RANK SEARCH.`);
        }

        console.log(`\n=> TOP 3 MERCK RETRIEVAL RESULTS:`);
        if (res.results && res.results.length > 0) {
            res.results.forEach((doc, idx) => {
                const snip = doc.content.replace(/\n/g, ' ').substring(0, 150) + "...";
                console.log(`   [${idx + 1}] Score: ${(doc.similarity * 100).toFixed(1)}% | Cat: ${doc.metadata?.clinical_category?.join(', ')}`);
                console.log(`       Preview: ${snip}`);
            });
        } else {
            console.log(`   (No Results Found)`);
        }
        console.log("\n---------------------------------------------------------------------\n");
    }
}

runTests();
