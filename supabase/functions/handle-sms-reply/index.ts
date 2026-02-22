import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import twilio from "npm:twilio";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    try {
        const formData = await req.formData();
        const from = formData.get('From');
        const body = formData.get('Body');

        if (!from || !body) {
            throw new Error("Missing From or Body in webhook payload");
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Twilio Setup (for reply)
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
        const client = twilio(accountSid, authToken);

        // 1. Find most recent active case for this phone number
        const { data: recentCase, error: findError } = await supabase
            .from('triage_cases')
            .select('*')
            .eq('client_phone_number', from)
            .eq('monitor_opt_in', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (findError || !recentCase) {
            console.log("No active case found for number:", from);
            // Optional: Reply "No active monitoring found."
            return new Response("OK", { status: 200 }); // Twilio expects 200
        }

        // 2. Append User Message to History
        const history = recentCase.monitoring_history || [];
        history.push({ role: 'user', content: body.toString(), timestamp: new Date().toISOString() });

        // 3. Call AI Logic
        const aiResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-symptom`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({
                monitoring_mode: true,
                monitoring_history: history,
                original_analysis: recentCase.ai_analysis,
                pet: { species: 'pet' }
            })
        });

        const aiData = await aiResponse.json();
        const replyText = aiData.reply_text || "Thank you for the update.";
        const status = aiData.status;

        // 4. Send Reply
        await client.messages.create({
            body: replyText,
            from: fromNumber,
            to: from.toString()
        });

        // 5. Update DB
        const updatePayload: any = {
            monitoring_history: [...history, { role: 'ai', content: replyText, timestamp: new Date().toISOString() }]
        };

        if (status === 'RESOLVED' || status === 'ESCALATED') {
            updatePayload.outcome_status = status;
            // Optionally stop monitoring? 
            // updatePayload.monitor_opt_in = false; // maybe keep it true so history is preserved or user can still reply? keeping true for conversation continuity for MVP
        }

        await supabase
            .from('triage_cases')
            .update(updatePayload)
            .eq('id', recentCase.id);

        return new Response("<Response></Response>", {
            headers: { "Content-Type": "text/xml" },
            status: 200,
        });

    } catch (error) {
        console.error("Webhook Error:", error);
        return new Response(error.message, { status: 500 });
    }
});
