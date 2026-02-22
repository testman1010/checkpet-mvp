import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: '../.env.local' });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabase
        .from('merck_knowledge_base')
        .select('metadata')
        .not('metadata', 'is', null)
        .limit(3);
    if (error) console.error(error);
    else console.log("Metadata sample:", JSON.stringify(data, null, 2));
}
check();
