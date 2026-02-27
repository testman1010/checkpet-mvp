import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

async function uploadImageBackground(caseId: string, base64Data: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Strip out the data URI prefix if it exists
        const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

        // Convert base64 to Buffer
        const buffer = Buffer.from(base64Content, 'base64');

        // Determine mime type (default to jpeg as standard)
        const mimeType = 'image/jpeg';
        const fileName = `${caseId}.jpg`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('triage-images')
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabaseAdmin
            .storage
            .from('triage-images')
            .getPublicUrl(fileName);

        // Update the database row with the new image URL
        if (urlData?.publicUrl) {
            await supabaseAdmin
                .from('triage_cases')
                .update({ image_url: urlData.publicUrl })
                .eq('id', caseId);
        }
    } catch (err) {
        console.error(`Failed to upload image for case ${caseId}:`, err);
    }
}

export async function POST(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const body = await req.json();
        const { symptoms, ai_analysis, deviceId, userId, isLocked, imageBase64 } = body;

        if (!symptoms || !ai_analysis) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const payload: any = {
            symptoms,
            ai_analysis,
            is_locked: isLocked || false
        };

        if (userId) {
            payload.user_id = userId;
        } else if (deviceId) {
            // Only attach session_id if we don't have a hard user_id to prevent constraint conflicts
            payload.session_id = deviceId;
        }

        const { data, error } = await supabaseAdmin
            .from('triage_cases')
            .insert([payload])
            .select('id')
            .single();

        if (error) {
            console.error("Supabase Insert Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Background process to upload the image without blocking the UI
        if (imageBase64) {
            uploadImageBackground(data.id, imageBase64).catch(err => console.error("Background upload failed:", err));
        }

        return NextResponse.json({ case_id: data.id });
    } catch (err: any) {
        console.error("Save Case API Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
