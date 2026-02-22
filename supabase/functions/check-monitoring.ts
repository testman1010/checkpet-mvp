
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMonitoring() {
    console.log("Checking triage_cases for recent monitoring opt-ins...");

    // Get the most recent case created in the last hour
    const { data, error } = await supabase
        .from('triage_cases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("Error querying db:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No recent cases found in 'triage_cases'.");
        return;
    }

    const latest = data[0];
    console.log("\n--- LATEST CASE FOUND ---");
    console.log("ID:", latest.id);
    console.log("Created At:", latest.created_at);
    console.log("Phone:", latest.client_phone_number);
    console.log("Monitoring Opt-In:", latest.monitor_opt_in);
    console.log("Follow-Up Time:", latest.follow_up_time);
    console.log("Urgency:", latest.urgency_level);
    console.log("Symptoms:", latest.symptoms.substring(0, 50) + "...");

    console.log("\n--- VERIFICATION ---");
    if (latest.monitor_opt_in && latest.client_phone_number) {
        console.log("✅ SUCCESS: Monitoring is active and phone number is saved.");
    } else {
        console.log("❌ FAILURE: Monitoring flag is false or phone missing.");
    }
}

checkMonitoring();
