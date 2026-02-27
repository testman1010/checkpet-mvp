import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use admin client to query securely across the database
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: NextRequest) {
    try {
        // 1. Verify the user is authenticated from the Authorization header or session
        const authHeader = req.headers.get('authorization');
        let userId = null;

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (!authError && user) {
                userId = user.id;
            }
        }

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch the most recently locked scan for this user
        const { data, error } = await supabaseAdmin
            .from('triage_cases')
            .select('ai_analysis, id')
            .eq('user_id', userId)
            .eq('is_locked', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return NextResponse.json({ message: "No locked cases found.", ai_analysis: null });
            }
            console.error("Supabase Query Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            ai_analysis: data?.ai_analysis,
            case_id: data?.id
        });
    } catch (err: any) {
        console.error("Restore Case API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
