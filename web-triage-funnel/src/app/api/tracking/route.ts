import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
    try {
        const { deviceId, userId, action = 'check' } = await req.json();

        if (!deviceId && !userId) {
            return NextResponse.json({ error: "Missing identity" }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        let currentCount = 0;
        let paymentStatus = 'inactive';
        let lastScanDate = new Date();

        const checkDateAndReset = (dateStr: string, count: number) => {
            if (!dateStr) return 0;
            const lastDate = new Date(dateStr);
            const now = new Date();
            // If different month or different year, reset
            if (lastDate.getMonth() !== now.getMonth() || lastDate.getFullYear() !== now.getFullYear()) {
                return 0;
            }
            return count;
        };

        if (action === 'merge' && userId && deviceId) {
            // Provide a way to merge anonymous counts into a newly recognized user
            let { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
            if (!user) {
                await supabase.from('users').insert([{ id: userId, payment_status: 'inactive', monthly_scan_count: 0 }]);
                user = { monthly_scan_count: 0, payment_status: 'inactive', last_scan_date: new Date().toISOString() };
            }

            let { data: anon } = await supabase.from('anonymous_sessions').select('*').eq('session_id', deviceId).single();

            let userCount = checkDateAndReset(user.last_scan_date, user.monthly_scan_count || 0);
            let anonCount = anon ? checkDateAndReset(anon.last_scan_date, anon.monthly_scan_count || 0) : 0;

            if (anonCount > 0) {
                userCount += anonCount;
                await supabase.from('users').update({
                    monthly_scan_count: userCount,
                    last_scan_date: new Date().toISOString()
                }).eq('id', userId);

                // Clear anon session so we don't double merge if they log in again later
                await supabase.from('anonymous_sessions').update({
                    monthly_scan_count: 0
                }).eq('session_id', deviceId);
            }

            // [CRITICAL FOR MAGIC LINK]: Transfer ownership of any locked triage cases 
            // from the anonymous session to the newly authenticated user
            await supabase.from('triage_cases')
                .update({ user_id: userId })
                .eq('session_id', deviceId)
                .is('user_id', null);

            return NextResponse.json({ count: userCount, paymentStatus: user.payment_status, needsAuth: false, needsPay: false });
        }

        if (userId) {
            // Check Authenticated User
            let { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();

            if (!user && !error) {
                // Create if missing
                await supabase.from('users').insert([{ id: userId, payment_status: 'inactive' }]);
                user = { monthly_scan_count: 0, payment_status: 'inactive', last_scan_date: new Date().toISOString() };
            }

            if (user) {
                currentCount = checkDateAndReset(user.last_scan_date, user.monthly_scan_count || 0);
                paymentStatus = user.payment_status || 'inactive';

                if (action === 'increment') {
                    currentCount += 1;
                    await supabase.from('users').update({ monthly_scan_count: currentCount, last_scan_date: new Date().toISOString() }).eq('id', userId);
                } else if (currentCount === 0 && user.monthly_scan_count > 0) {
                    // Reset requested implicitly
                    await supabase.from('users').update({ monthly_scan_count: 0, last_scan_date: new Date().toISOString() }).eq('id', userId);
                }
            }
        } else {
            // Check Anonymous Session
            let { data: anon, error } = await supabase.from('anonymous_sessions').select('*').eq('session_id', deviceId).single();

            if (!anon) {
                if (action === 'check') {
                    return NextResponse.json({ count: 0, paymentStatus: 'inactive', needsAuth: false, needsPay: false });
                } else if (action === 'increment') {
                    const { error: insertError } = await supabase.from('anonymous_sessions').insert([{
                        session_id: deviceId,
                        ip_address: ip,
                        user_agent: userAgent,
                        monthly_scan_count: 1,
                        last_scan_date: new Date().toISOString()
                    }]);
                    if (insertError) throw new Error(`Insert Init Error: ${insertError.message}`);
                    currentCount = 1;
                }
            } else {
                currentCount = checkDateAndReset(anon.last_scan_date, anon.monthly_scan_count || 0);

                if (action === 'increment') {
                    currentCount += 1;
                    const { error: updateError } = await supabase.from('anonymous_sessions').update({
                        monthly_scan_count: currentCount,
                        last_scan_date: new Date().toISOString(),
                        ip_address: ip,
                        user_agent: userAgent
                    }).eq('session_id', deviceId);
                    if (updateError) throw new Error(`Update Inc Error: ${updateError.message}`);
                } else if (currentCount === 0 && anon.monthly_scan_count > 0) {
                    await supabase.from('anonymous_sessions').update({ monthly_scan_count: 0, last_scan_date: new Date().toISOString() }).eq('session_id', deviceId);
                }
            }
        }

        const needsAuth = currentCount >= 2 && !userId;
        const needsPay = currentCount >= 3 && paymentStatus !== 'active';

        return NextResponse.json({
            count: currentCount,
            paymentStatus,
            needsAuth,
            needsPay,
            allowedCheck: !needsAuth && !needsPay
        });

    } catch (error: any) {
        console.error("Tracking error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
