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

async function runTest(queryText) {
    console.log(`\n======================================================`);
    console.log(`TESTING V2 GET FOR QUERY: "${queryText}"`);
    console.log(`======================================================\n`);

    const v2Model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const v2Result = await v2Model.embedContent(queryText);
    const v2Vector = v2Result.embedding.values.slice(0, 768);

    const { data: v2Data, error: v2Error } = await supabase.rpc('match_merck_v2', {
        query_embedding: v2Vector,
        match_threshold: 0.1, // very low to just see how it ranks
        match_count: 5,
        // using empty filter 
        filter: {}
    });

    if (v2Error) {
        console.error("V2 Error:", v2Error.message);
    } else {
        if (v2Data && v2Data.length > 0) {
            v2Data.forEach((d, i) => {
                console.log(`  [${i + 1}] Similarity: ${(d.similarity * 100).toFixed(1)}% | Source: ${d.metadata?.source} pg ${d.metadata?.page}`);
                console.log(`      Categories: ${d.metadata?.clinical_category?.join(', ')}`);
                const snip2 = d.content ? d.content.substring(0, 150).replace(/\n/g, ' ') : '';
                console.log(`      Snippet: ${snip2}...`);
            });
        } else {
            console.log("  No matches found even at threshold 0.1");

            // Quick debug - check if we can even successfully query the RPC
            console.log("\n  -> Attempting unfiltered limit 1 just to verify RPC functionality...");
            const { data: verifyData } = await supabase.rpc('match_merck_v2', {
                query_embedding: v2Vector,
                match_threshold: 0.0,
                match_count: 1
            });
            console.log("  -> RPC verification returned:", verifyData ? verifyData.length : "error");
        }
    }
}

async function main() {
    const tests = [
        "What are the common symptoms and treatment for chocolate toxicity in dogs?",
        "feline calicivirus stomatitis immune disease",
        "emergency care for a cat that fell from a window trauma"
    ];

    for (const test of tests) {
        await runTest(test);
    }
}

main();
