import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import twilio from "npm:twilio";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Basic Auth Check (invoked by Cron with Service Key)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Twilio Setup
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

        // Log if missing Twilio envs (for dev debugging)
        if (!accountSid || !authToken || !fromNumber) {
            console.error("Missing Twilio Configuration");
            // Don't crash, just return success so Cron doesn't retry forever
            return new Response(JSON.stringify({ error: "Missing Twilio Config" }), { headers: corsHeaders, status: 200 });
        }

        const client = twilio(accountSid, authToken);

        // 1. Get Pending Follow-ups
        // "monitor_opt_in" IS TRUE, "follow_up_sent" IS FALSE, "follow_up_time" < NOW()
        const { data: cases, error: fetchError } = await supabase
            .from('triage_cases')
            .select('*')
            .eq('monitor_opt_in', true)
            .eq('follow_up_sent', false)
            .lt('follow_up_time', new Date().toISOString())
            .limit(10); // Batch size to limit timeout risk

        if (fetchError) throw fetchError;

        if (!cases || cases.length === 0) {
            return new Response(JSON.stringify({ message: "No pending follow-ups" }), { headers: corsHeaders, status: 200 });
        }

        const results = [];

        // 2. Process each case
        for (const c of cases) {
            try {
                // A. Call AI to generate specific check-in question
                // calling internal function logic directly or simply invoking the endpoint?
                // Direct invocation is cleaner for separation of concerns
                const aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-symptom`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
                    },
                    body: JSON.stringify({
                        monitoring_mode: true,
                        monitoring_history: c.monitoring_history || [],
                        original_analysis: c.ai_analysis,
                        pet: { species: 'pet' } // can extract from symptoms or analysis if saved, currently analysis has it
                    })
                });

                const aiData = await aiResponse.json();
                const messageBody = aiData.reply_text || `Hi, this is CheckPet. Checking in on your pet. Are they doing better? Reply YES or NO.`;

                // B. Send SMS
                const message = await client.messages.create({
                    body: messageBody,
                    from: fromNumber,
                    to: c.client_phone_number
                });

                // C. Update DB
                const history = c.monitoring_history || [];
                history.push({ role: 'ai', content: messageBody, timestamp: new Date().toISOString() });

                await supabase
                    .from('triage_cases')
                    .update({
                        follow_up_sent: true,
                        monitoring_history: history
                    })
                    .eq('id', c.id);

                results.push({ id: c.id, status: 'sent', sid: message.sid });

            } catch (err) {
                console.error(`Failed to process case ${c.id}:`, err);
                results.push({ id: c.id, status: 'failed', error: err.message });
            }
        }

        return new Response(JSON.stringify({ results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
