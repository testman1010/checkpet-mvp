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

        // --- Meta Conversions API: Server-Side Purchase Event ---
        // Fire regardless of mode to ensure accurate purchase attribution
        try {
            const purchaseValue = session.mode === 'subscription' ? 9.99 : 3.99;
            const customerEmail = session.customer_details?.email;

            const capiPayload = {
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                event_source_url: 'https://checkpet.vet',
                user_data: {
                    email: customerEmail || undefined,
                },
                custom_data: {
                    value: purchaseValue,
                    currency: 'USD',
                    content_name: session.mode === 'subscription' ? 'subscription' : 'emergency_scan',
                },
            };

            // Use internal API route for CAPI to keep token server-side
            const baseUrl = process.env.NODE_ENV === 'development'
                ? 'http://localhost:3000'
                : process.env.VERCEL_URL
                    ? `https://${process.env.VERCEL_URL}`
                    : 'https://checkpet.vet';

            const capiUrl = `${baseUrl}/api/meta-capi`;

            await fetch(capiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(capiPayload),
            });

            console.log(`[CAPI] Purchase event sent for ${customerEmail || userId}`);
        } catch (capiErr) {
            console.warn('[CAPI] Failed to send Purchase event:', capiErr);
        }

        // --- PostHog: Server-Side Purchase Event (source of truth for revenue) ---
        // The client-side `purchase_verified` event only fires if the user lands back
        // on the /?checkout=success URL AND isn't running an ad blocker — so it badly
        // undercounts. This server event fires on every Stripe-confirmed payment and is
        // the reliable revenue signal for the monetization funnel.
        try {
            const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
            if (posthogKey) {
                const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
                const purchaseValue = session.mode === 'subscription' ? 9.99 : 3.99;
                await fetch(`${posthogHost}/capture/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        api_key: posthogKey,
                        event: 'purchase_completed',
                        // Tie to the identified Supabase user (posthog.identify uses this id on
                        // unlock) so the purchase merges into that person's timeline. Fall back to
                        // the Stripe customer/session id for guest edge cases.
                        distinct_id: userId || stripeCustomerId || session.id,
                        properties: {
                            value: purchaseValue,
                            currency: 'USD',
                            product_type: (session.metadata && session.metadata.type)
                                || (session.mode === 'subscription' ? 'subscription' : 'emergency_scan'),
                            mode: session.mode,
                            stripe_customer_id: stripeCustomerId,
                            stripe_session_id: session.id,
                            source: 'stripe_webhook',
                            $process_person_profile: true,
                        },
                    }),
                });
                console.log(`[PostHog] purchase_completed sent for ${userId || session.id}`);
            }
        } catch (phErr) {
            console.warn('[PostHog] Failed to send purchase_completed (non-fatal):', phErr);
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
