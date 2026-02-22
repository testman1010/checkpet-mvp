import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Setup Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("Missing GEMINI_API_KEY in .env.local");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(apiKey);

// Initialize Supabase. (Using anon key works since RLS is disabled)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// We process in batches of 50 to respect the 3000 queries/minute (50/sec) limit
const BATCH_SIZE = 50;

let lastId = '00000000-0000-0000-0000-000000000000';

async function processBatch() {
    const { data: rows, error: fetchError } = await supabase
        .from('merck_knowledge_base')
        .select('id, content')
        .is('embedding_v2', null)
        .gt('id', lastId)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);

    if (fetchError) {
        console.error("Error fetching rows:", fetchError);
        return 0;
    }

    if (!rows || rows.length === 0) {
        return 0;
    }

    // Update lastId to the maximum id in this batch (since it's ordered, it's the last element)
    lastId = rows[rows.length - 1].id;


    console.log(`Processing batch of ${rows.length} rows...`);

    // Process concurrently with Promise.all
    const promises = rows.map(async (row) => {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

            // We use outputDimensionality if supported by SDK, otherwise we slice the result to guarantee 768 dims
            // Truncation works reasonably well since embeddings are often distributed with heavier weight in early dims
            const embeddingResult = await model.embedContent(row.content);
            const embeddingValues = embeddingResult.embedding.values.slice(0, 768);

            const { error: updateError } = await supabase
                .from('merck_knowledge_base')
                .update({ embedding_v2: embeddingValues })
                .eq('id', row.id);

            if (updateError) {
                console.error(`Failed to update id ${row.id}:`, updateError.message);
                return false;
            }
            return true;
        } catch (err) {
            console.error(`Failed to embed/update id ${row.id}:`, err.message);
            return false;
        }
    });

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r).length;
    console.log(`Successfully updated ${successCount}/${rows.length} rows.`);

    return rows.length;
}

async function main() {
    console.log("Starting migration to gemini-embedding-001 (768 dims)...");
    let totalProcessed = 0;
    while (true) {
        const batchStartTime = Date.now();

        const processed = await processBatch();
        if (processed === 0) {
            console.log(`Migration complete. Total processed: ${totalProcessed}`);
            break;
        }
        totalProcessed += processed;

        // Ensure we take AT LEAST 1 second per batch to stay under 50/sec = 3000/min
        const elapsed = Date.now() - batchStartTime;
        if (elapsed < 1000) {
            await new Promise(r => setTimeout(r, 1000 - elapsed));
        }
    }
}

main();
