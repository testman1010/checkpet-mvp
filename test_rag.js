import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "npm:@supabase/supabase-js";
import 'npm:dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    console.log("Embedding...");
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const embeddingResult = await embeddingModel.embedContent("Dog ate a grape");
    const embeddingValues = embeddingResult.embedding.values.slice(0, 768);
    console.log("Dims:", embeddingValues.length);
    console.log("Querying DB...");
    const { data, error } = await supabase.rpc('match_merck_v2', {
        query_embedding: embeddingValues,
        match_threshold: 0.1,
        match_count: 1
    });
    console.log(data ? "Docs found: " + data.length : "Error: " + error?.message);
}
test();
