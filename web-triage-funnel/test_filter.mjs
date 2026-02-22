import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: '../.env.local' });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testFilter() {
    const rpcParams = {
        query_embedding: new Array(768).fill(0.1),
        match_threshold: 0.1,
        match_count: 1,
        filter: { species: ["Dog"] }
    };
    const { data: documents, error } = await supabase.rpc('match_documents', rpcParams);
    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Success! Documents found:", documents?.length);
    }
}
testFilter();
