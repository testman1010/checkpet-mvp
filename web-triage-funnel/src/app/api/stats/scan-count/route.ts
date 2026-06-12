import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// In-memory cache (survives across requests in the same serverless instance)
let cached: { count: number; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/stats/scan-count
 * Returns the total number of triage scans completed.
 * Used for social-proof display on pSEO CTAs and homepage.
 */
export async function GET() {
    // Return cache if fresh
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return NextResponse.json({ count: cached.count }, {
            headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
        });
    }

    try {
        // Count rows in triage_cases (each row = one completed scan).
        // BUG FIX: previously queried a non-existent 'cases' table, so the
        // social-proof counter always showed the fallback value of 75.
        const { count, error } = await supabase
            .from('triage_cases')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('scan-count error:', error);
            return NextResponse.json({ count: 75 }); // fallback
        }

        const total = count ?? 75;
        cached = { count: total, ts: Date.now() };

        return NextResponse.json({ count: total }, {
            headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
        });
    } catch (err) {
        console.error('scan-count exception:', err);
        return NextResponse.json({ count: 75 }); // fallback
    }
}
