import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // Initialize Stripe (requires STRIPE_SECRET_KEY in .env.local)
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
            apiVersion: "2024-04-10" as any,
        });

        // Initialize Supabase Admin Client to verify the user exists
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { userId, type } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
        }

        if (!type || (type !== 'emergency_scan' && type !== 'subscription')) {
            return NextResponse.json({ error: "Invalid checkout type" }, { status: 400 });
        }

        // Attempt to lookup the user in Supabase to fetch an existing Stripe Customer ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        // We also need their email to pre-fill checkout and prevent them from using a different email
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        const userEmail = authUser?.user?.email;

        let customerId = user?.stripe_customer_id;

        // If no stripe customer id, you could create one here, or let Stripe Checkout create it
        // Then webhook will grab it. We'll let Checkout handle it for simplicity.

        // Define line items based on user choice
        const lineItems = type === 'emergency_scan'
            ? [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Single Emergency Scan",
                            description: "Unlock immediate access to a single multimodal AI analysis for your pet.",
                        },
                        unit_amount: 399, // $3.99
                    },
                    quantity: 1,
                },
            ]
            : [
                {
                    // For MVP subscriptions, we fetch the default price of the product
                    // The user provided product ID: prod_U3NRdGdJtyXhFg
                    price: (await stripe.products.retrieve('prod_U3NRdGdJtyXhFg')).default_price as string,
                    quantity: 1,
                },
            ];

        const mode = type === 'subscription' ? 'subscription' : 'payment';

        const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        const checkoutPayload: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ["card"],
            line_items: lineItems as any,
            mode: mode,
            success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/`,
            client_reference_id: userId, // CRITICAL: This ties the payment to the Supabase User
            metadata: {
                type: type
            }
        };

        if (customerId) {
            checkoutPayload.customer = customerId;
            checkoutPayload.customer_update = { name: 'auto' };
        } else if (userEmail) {
            // We NO LONGER pass customer_email here.
            // When Stripe receives `customer_email`, it permanently locks the email field on the checkout page.
            // By leaving it blank, Stripe will present an empty, editable email field to the user so they can 
            // fix any typos they made on the Auth Wall.
            // The Webhook intercepts their final typed email and syncs it back to Supabase.
        }

        const session = await stripe.checkout.sessions.create(checkoutPayload);

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error("Stripe Checkout Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
