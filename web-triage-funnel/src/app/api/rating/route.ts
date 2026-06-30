import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

/**
 * Result rating (thumbs 👍/👎) capture.
 *
 * The in-app thumbs originally fired a client-side `posthog.capture('result_rated')`,
 * but browser-side captures are silently dropped by adblockers / privacy browsers
 * (the same issue that hit `purchase_verified`), so ratings never reached PostHog.
 *
 * This route captures the rating server-side, where adblockers can't interfere:
 *   1. durable log in the Supabase `result_ratings` table, and
 *   2. a server-side PostHog `result_rated` event (feeds the Helpful-rate insight).
 * Both writes are best-effort and non-fatal so a single failure never errors the client.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rating = body?.rating;

        if (rating !== 'up' && rating !== 'down') {
            return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
        }

        const row = {
            rating,
            rating_value: rating === 'up' ? 1 : 0,
            urgency_level: body.urgency_level ?? null,
            primary_condition: body.primary_condition ?? null,
            confidence: typeof body.confidence === 'number' ? body.confidence : null,
            is_emergency: !!body.is_emergency,
            case_id: body.case_id ?? null,
            source: body.source ?? 'live',
            distinct_id: body.distinct_id ?? null,
        };

        // 1) Durable log in Supabase (source of record).
        try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { error } = await supabase.from('result_ratings').insert([row]);
            if (error) console.error('[rating] Supabase insert failed (non-fatal):', error);
        } catch (dbErr) {
            console.error('[rating] Supabase error (non-fatal):', dbErr);
        }

        // 2) Server-side PostHog capture — adblock-proof, so the Helpful-rate insight populates.
        try {
            const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
            if (posthogKey) {
                const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
                await fetch(`${posthogHost}/capture/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: posthogKey,
                        event: 'result_rated',
                        // Use the client's PostHog distinct_id so the rating attaches to that person's
                        // timeline; fall back to the case id for the rare anonymous edge case.
                        distinct_id: row.distinct_id || row.case_id || 'anonymous',
                        properties: {
                            rating: row.rating,
                            rating_value: row.rating_value,
                            urgency_level: row.urgency_level,
                            primary_condition: row.primary_condition,
                            confidence: row.confidence,
                            is_emergency: row.is_emergency,
                            case_id: row.case_id,
                            source: row.source,
                            capture_source: 'server',
                            $process_person_profile: true,
                        },
                    }),
                });
            }
        } catch (phErr) {
            console.warn('[rating] PostHog server capture failed (non-fatal):', phErr);
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('[rating] Error:', e);
        return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
    }
}
