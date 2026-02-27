import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    try {
        const { email } = await req.json();
        if (!email) return NextResponse.json({ error: "No email" }, { status: 400 });

        let finalUserId: string | undefined;

        // Try creating the user first
        const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8) + "!";
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true
        });

        if (createData?.user) {
            finalUserId = createData.user.id;
        }

        // If they already exist, find them
        if (createError && (createError.message?.includes("already registered") || createError.status === 422)) {
            // listUsers is fine for MVP. For scale, use a custom profiles table lookup.
            const { data: users } = await supabaseAdmin.auth.admin.listUsers();
            const existing = users.users.find(u => u.email === email);
            if (existing) {
                finalUserId = existing.id;
            } else {
                return NextResponse.json({ error: "Failed to find existing user" }, { status: 400 });
            }
        } else if (createError && !finalUserId) {
            return NextResponse.json({ error: createError.message || "Unknown user creation error" }, { status: 400 });
        }

        if (finalUserId) {
            // Ensure public profile exists for tracking foreign constraints
            await supabaseAdmin.from('users').upsert({ id: finalUserId }, { onConflict: 'id' }).select();
            return NextResponse.json({ userId: finalUserId });
        }

        return NextResponse.json({ error: "Failed to process user identification" }, { status: 500 });
    } catch (err: any) {
        console.error("Unlock Auth Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
