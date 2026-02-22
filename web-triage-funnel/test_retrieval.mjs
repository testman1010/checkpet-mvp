import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env relative to this script inside web-triage-funnel
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Setup Gemini
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Initialize Supabase.
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testRetrieval(queryText) {
    console.log(`\nTesting retrieval for query: "${queryText}"`);
    console.log("Generating embedding with gemini-embedding-001...");

    // 1. Embed the testing query with gemini-embedding-001 (expecting 768 dims)
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const embeddingResult = await model.embedContent(queryText);
    const queryEmbedding = embeddingResult.embedding.values.slice(0, 768);

    console.log("Searching Supabase database using match_merck_v2...");

    // 2. Call the new RPC function for the v2 column
    // NOTE: You will need to create this RPC function in Supabase first!
    const { data, error } = await supabase.rpc('match_merck_v2', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3, // lowered threshold for testing
        match_count: 3
    });

    if (error) {
        console.error("Retrieval failed:", error.message);
        console.error("\nMake sure you have executed the SQL command to create the 'match_merck_v2' RPC function in your Supabase SQL editor!");
        return;
    }

    if (!data || data.length === 0) {
        console.log("No results found. (Try a different query or lowering the match_threshold inside the script)");
        return;
    }

    console.log(`Found ${data.length} results:\n`);
    data.forEach((result, idx) => {
        console.log(`===============================================`);
        console.log(`=== Result ${idx + 1} (Similarity: ${(result.similarity * 100).toFixed(1)}%)`);
        console.log(`===============================================\n`);

        // Print a snippet of the content
        let contentSnippet = result.content;
        if (contentSnippet && contentSnippet.length > 500) {
            contentSnippet = contentSnippet.substring(0, 500) + "... [truncated]";
        }
        console.log(contentSnippet);
        console.log("\n");
    });
}

async function main() {
    // Default test query
    const defaultQuery = "What are the common symptoms and treatment for chocolate toxicity in dogs?";

    // Allow overriding via command line args: node test_retrieval.mjs "my custom query"
    const args = process.argv.slice(2);
    const query = args.length > 0 ? args.join(" ") : defaultQuery;

    await testRetrieval(query);
}

main();
