import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Use Admin client to securely traverse device/user matches securely
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    try {
        const urlParams = new URL(req.url);
        const deviceId = urlParams.searchParams.get('deviceId');

        // 1. Resolve Identity
        const authHeader = req.headers.get('authorization');
        let userId = null;

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (!authError && user) {
                userId = user.id;
            }
        }

        if (!userId && !deviceId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Build Query
        let query = supabaseAdmin
            .from('triage_cases')
            .select('id, created_at, ai_analysis, image_url')
            .order('created_at', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        } else if (deviceId) {
            // Only pull session cases if no hard user account is established
            query = query.eq('session_id', deviceId).is('user_id', null);
        }

        // 3. Execute
        const { data, error } = await query;

        if (error) {
            console.error("History fetch error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Format for the frontend History View
        const formattedHistory = data.map((caseRow: any) => ({
            id: caseRow.id,
            timestamp: new Date(caseRow.created_at).getTime(),
            date: new Date(caseRow.created_at).toLocaleDateString(),
            time: new Date(caseRow.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            result: caseRow.ai_analysis,
            image_url: caseRow.image_url
        }));

        return NextResponse.json({ history: formattedHistory });

    } catch (err: any) {
        console.error("Cases History API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
