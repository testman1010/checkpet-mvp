import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
        apiVersion: "2024-04-10" as any,
    });

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    try {
        if (!sig || !endpointSecret) {
            console.error("Missing Stripe signature or secret");
            return NextResponse.json({ error: "Missing config" }, { status: 400 });
        }
        event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;

        // Extract internal tracking IDs
        const userId = session.client_reference_id;
        const stripeCustomerId = session.customer as string;
        const mode = session.mode;

        if (userId) {
            // Update Supabase
            console.log(`Fulfilling ${mode} checkout for User: ${userId}`);

            // [OPTION B - Email Reconciliation]
            // If the user typed a real email into the Stripe checkout (e.g. for their receipt),
            // but had a fake/typo'd email in Supabase from the Scan 2 Auth Wall, we automatically 
            // sync the Supabase account to match the Stripe email so they can log in via Magic Link.
            const stripeProvidedEmail = session.customer_details?.email;
            if (stripeProvidedEmail) {
                const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, {
                    email: stripeProvidedEmail,
                    user_metadata: { email_synced_from_stripe: true }
                });
                if (authUpdateError) {
                    console.warn(`Failed to sync Stripe email to Supabase Auth for ${userId}:`, authUpdateError);
                } else {
                    console.log(`Synced Supabase email to Stripe origin: ${stripeProvidedEmail}`);
                }
            }

            if (mode === 'subscription') {
                const { error } = await supabase
                    .from('users')
                    .update({
                        payment_status: 'active',
                        stripe_customer_id: stripeCustomerId
                    })
                    .eq('id', userId);

                if (error) {
                    console.error("Failed to update user in Supabase:", error);
                    return NextResponse.json({ error: "Failed database update" }, { status: 500 });
                }
            } else if (mode === 'payment') {
                // For a single scan, we just record the customer ID but DO NOT grant permanent active status.
                // The frontend unlocks the current session locally via the checkout=success URL parameter.
                const { error } = await supabase
                    .from('users')
                    .update({
                        stripe_customer_id: stripeCustomerId
                    })
                    .eq('id', userId);

                if (error) {
                    console.error("Failed to update user customer ID in Supabase:", error);
                }
            }
        } else {
            console.warn("Checkout completed but no client_reference_id found.");
        }
    }

    // Handle subscription cancellations/failures if needed
    if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
        const obj = event.data.object as any;
        const customerId = obj.customer;

        if (customerId) {
            await supabase
                .from('users')
                .update({ payment_status: 'inactive' })
                .eq('stripe_customer_id', customerId);
        }
    }

    return NextResponse.json({ received: true });
}
