
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Check the most recent case
        const { data: cases, error } = await supabase
            .from('triage_cases')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        // Also try to check pg_cron logs if possible (requires admin, might fail via JS client but worth a try via rpc if exists, skipping for now)

        return new Response(JSON.stringify({
            success: true,
            cases: cases.map(c => ({
                id: c.id,
                created_at: c.created_at,
                phone: c.client_phone_number,
                monitor_opt_in: c.monitor_opt_in,
                follow_up_time: c.follow_up_time,
                follow_up_sent: c.follow_up_sent,
                now_server_time: new Date().toISOString()
            }))
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
