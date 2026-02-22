import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
    const { data, error } = await supabase.from('merck_v2_documents').select('*').limit(1);
    if (error) console.error("DB Error:", error);
    if (data && data.length > 0) {
        console.log("Cols:", Object.keys(data[0]));
        console.log("metadata:", data[0].metadata);
    }
}
test();
