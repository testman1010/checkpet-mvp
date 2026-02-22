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

// --- RAG Helper Function (from the updated analyze-symptom) ---
async function retrieveVeterinaryContext(queryText, species, isRefinementMode = false) {
    console.log(`\n[1/4] Generating RAG Search Parameters for: "${queryText}"`);
    const fastModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const queryPrompt = `
        You are a search optimization agent for a veterinary database.
        Analyze the user's description and "translate" it into strict search parameters.
        Prioritize broad categorization.

        SEARCH TARGET: "${queryText}"
        PET SPECIES: "${species}"

        RULES:
        1. "clinical_category": Return up to 3 most relevant categories(e.g., "Dermatology", "Emergency", "Toxicology", "Gastroenterology", "General Principles").
        2. "species": If input is "Dog", return ["Dog", "General", "Unknown"].
        3. "search_query": A short, keyword-dense query optimized for vector similarity.
        
        Return ONLY JSON:
        { "clinical_category": ["string"], "species": ["string"], "search_query": "string" }
    `;

    const queryResult = await fastModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: queryPrompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const queryParams = JSON.parse(queryResult.response.text());
    console.log("      -> Generated Params:", queryParams);

    const performSearch = async (useFilters) => {
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embeddingResult = await embeddingModel.embedContent(queryParams.search_query);

        const rpcParams = {
            query_embedding: embeddingResult.embedding.values.slice(0, 768),
            match_threshold: isRefinementMode ? 0.30 : (useFilters ? 0.5 : 0.35),
            match_count: isRefinementMode ? 8 : 5
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

    console.log(`\n[2/4] Searching Database (Strict Mode)...`);
    let searchResults = await performSearch(true);

    if (!searchResults.documents || searchResults.documents.length === 0) {
        console.log("      -> Strict search returned 0 results. Triggering Fallback Rank Search...");
        searchResults = await performSearch(false);
    }

    if (searchResults.error) {
        console.error("Vector search error:", searchResults.error);
        return "";
    } else if (searchResults.documents && searchResults.documents.length > 0) {
        console.log(`      -> Retrieved ${searchResults.documents.length} highly relevant documents!`);
        return searchResults.documents.map((d) =>
            `[Reference: Merck Veterinary Manual, Source: ${d.metadata?.source || 'Unknown'}, Page: ${d.metadata?.page || 'Unknown'}]\n${d.content}`
        ).join("\n\n---\n\n");
    } else {
        return "No specific veterinary protocols found in database after fallback search.";
    }
}

async function runEndToEnd() {
    const petData = { name: "Buster", species: "Dog", breed: "Golden Retriever" };
    const symptom = "My 5 year old dog just ate a whole dark chocolate bar and threw up once. He looks a little shaky. Is this an emergency?";

    const contextText = await retrieveVeterinaryContext(symptom, petData.species);

    console.log(`\n[3/4] Generating Triage Output using context...`);

    const prompt = `You are an advanced veterinary AI assistant. Analyze the input: "${symptom}" for ${petData.name}.
    
    [VETERINARY CONTEXT]
    ${contextText}

    Expected JSON structure:
    {
        "primaryRecommendation": "string",
        "urgencyLevel": "CRITICAL",
        "causes": [{"condition": "string", "probability": 90}],
        "triage_strategy": {"immediate_aid": ["string"]}
    }
    Return ONLY JSON.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    });

    console.log(`\n[4/4] Output Complete!`);
    console.log(JSON.stringify(JSON.parse(result.response.text()), null, 2));
}

runEndToEnd();
