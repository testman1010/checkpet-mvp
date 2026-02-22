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

        const { symptoms, ai_analysis } = await req.json();

        // Extract urgency level from analysis
        const urgency_level = ai_analysis.urgencyLevel || ai_analysis.urgency_level || 'UNKNOWN';

        const { data, error } = await supabase
            .from('triage_cases')
            .insert([
                {
                    symptoms,
                    ai_analysis,
                    urgency_level
                }
            ])
            .select('id')
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ case_id: data.id }), {
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
