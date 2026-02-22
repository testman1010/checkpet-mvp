import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { case_id, phone_number } = await req.json();

        if (!case_id || !phone_number) {
            throw new Error("Missing case_id or phone_number");
        }

        // Basic phone validation (digits only, length check)
        const cleanPhone = phone_number.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            throw new Error("Invalid phone number format");
        }

        // Ensure +1 for US/Canada if not present (simple MVP assumption)
        // ideally use libphonenumber, but for MVP keep it simple
        const formattedPhone = phone_number.startsWith('+') ? phone_number : `+1${cleanPhone}`;

        const { error } = await supabase
            .from('triage_cases')
            .update({
                client_phone_number: formattedPhone,
                monitor_opt_in: true,
                follow_up_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // NOW + 2 hours
                outcome_status: 'MONITORING'
            })
            .eq('id', case_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, message: "Monitoring activated" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
