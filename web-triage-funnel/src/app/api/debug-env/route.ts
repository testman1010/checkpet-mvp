import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        timestamp: new Date().toISOString(),
        has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        has_stripe_key: !!process.env.STRIPE_SECRET_KEY,
        has_site_url: !!process.env.NEXT_PUBLIC_SITE_URL,
    });
}
