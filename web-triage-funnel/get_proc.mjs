import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: '../.env.local' });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function getProc() {
    const { data: { session } } = await supabase.auth.getSession();
    const query = `
      SELECT pg_get_functiondef(oid)
      FROM pg_proc
      WHERE proname = 'match_documents';
    `;

    // We can't run raw SQL using @supabase/supabase-js unless we have a specific RPC for it,
    // or we use the postgres connection string. Wait. Let's ask postgres directly if possible,
    // actually, I can't since I don't have the postgres connection string, only the REST URL.
}

getProc();
