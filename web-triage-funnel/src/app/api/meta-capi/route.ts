/**
 * Meta Conversions API (CAPI) server-side endpoint.
 *
 * Sends conversion events directly to Meta's servers for accurate attribution,
 * especially for Purchase events that may not fire client-side due to ad blockers
 * or redirect issues.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const PIXEL_ID = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
const ACCESS_TOKEN = process.env.META_CONVERSIONS_API_TOKEN || '';
const GRAPH_API_VERSION = 'v21.0';

function hashSHA256(value: string): string {
    // Edge runtime supports Web Crypto — but for simplicity use TextEncoder approach
    // For edge runtime, we'll do a simple sync hash via SubtleCrypto workaround
    // Actually in Next.js edge runtime, we can use the crypto global
    const encoder = new TextEncoder();
    const data = encoder.encode(value.trim().toLowerCase());
    // We need to use async subtle crypto but this is a sync context...
    // Let's compute hash manually using a simple approach
    // Actually, let's make the main function async and handle it there
    return value.trim().toLowerCase(); // placeholder, actual hashing done in handler
}

interface CAPIEventData {
    event_name: string;
    event_time?: number;
    user_data?: {
        email?: string;
        client_ip_address?: string;
        client_user_agent?: string;
        fbc?: string; // Facebook click ID from _fbc cookie
        fbp?: string; // Facebook browser ID from _fbp cookie
    };
    custom_data?: Record<string, any>;
    event_source_url?: string;
    action_source?: string;
}

async function sha256Hash(value: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(value.trim().toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
    try {
        if (!PIXEL_ID || !ACCESS_TOKEN) {
            return NextResponse.json(
                { error: 'Meta CAPI not configured' },
                { status: 500 }
            );
        }

        const body: CAPIEventData = await req.json();

        // Hash PII fields as required by Meta
        const userData: Record<string, any> = {};

        if (body.user_data?.email) {
            userData.em = [await sha256Hash(body.user_data.email)];
        }
        if (body.user_data?.client_ip_address) {
            userData.client_ip_address = body.user_data.client_ip_address;
        }
        if (body.user_data?.client_user_agent) {
            userData.client_user_agent = body.user_data.client_user_agent;
        }
        if (body.user_data?.fbc) {
            userData.fbc = body.user_data.fbc;
        }
        if (body.user_data?.fbp) {
            userData.fbp = body.user_data.fbp;
        }

        const eventPayload = {
            data: [
                {
                    event_name: body.event_name,
                    event_time: body.event_time || Math.floor(Date.now() / 1000),
                    action_source: body.action_source || 'website',
                    event_source_url: body.event_source_url || 'https://checkpet.vet',
                    user_data: userData,
                    custom_data: body.custom_data || {},
                },
            ],
        };

        const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventPayload),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[CAPI] Meta API error:', result);
            return NextResponse.json(
                { error: 'Meta API error', details: result },
                { status: response.status }
            );
        }

        return NextResponse.json({ success: true, events_received: result.events_received });
    } catch (error: any) {
        console.error('[CAPI] Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
