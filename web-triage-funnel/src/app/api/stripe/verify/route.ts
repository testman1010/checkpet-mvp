import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
        apiVersion: "2024-04-10" as any,
    });

    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({ verified: false, error: "Missing session_id" }, { status: 400 });
        }

        // Retrieve the session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Check if the payment was actually successful
        if (session.payment_status === 'paid') {
            return NextResponse.json({ verified: true });
        } else {
            return NextResponse.json({ verified: false, status: session.payment_status });
        }
    } catch (error: any) {
        console.error("Stripe Verify Error:", error);
        return NextResponse.json({ verified: false, error: error.message }, { status: 500 });
    }
}
