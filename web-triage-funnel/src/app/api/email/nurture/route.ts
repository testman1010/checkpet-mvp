/**
 * Email nurture sequence API route.
 *
 * Handles scheduling and sending of the 3-email drip sequence for users
 * who captured their email (Lead event) but haven't paid yet.
 *
 * Email 1 (Day 3): "Your scan results for [pet name]"  — resurface value
 * Email 2 (Day 7): "Is [pet name] doing better?"       — check-in
 * Email 3 (Day 14): "Your free scans just reset"        — bring them back
 *
 * Uses Resend for transactional email delivery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'CheckPet <noreply@checkpet.vet>';

interface NurtureRequest {
  userId: string;
  email?: string;
  action: 'schedule' | 'send';
  utmParams?: Record<string, string>;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('[Nurture] RESEND_API_KEY not configured, skipping email');
    return null;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error('[Nurture] Resend error:', error);
    return null;
  }

  return await res.json();
}

// Email templates
function getEmailTemplate(sequence: number, email: string): { subject: string; html: string } | null {
  const scanUrl = 'https://checkpet.vet';

  switch (sequence) {
    case 1:
      return {
        subject: 'Your pet scan results are saved',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <img src="https://checkpet.vet/checkpet-logo.png" alt="CheckPet" style="width: 40px; height: 40px; border-radius: 8px; margin-bottom: 16px;" />
            <h2 style="color: #0f172a; margin-bottom: 8px;">Your Scan Results</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 15px;">
              Hi there — your recent pet symptom scan is saved and ready to review anytime at CheckPet.
            </p>
            <p style="color: #475569; line-height: 1.6; font-size: 15px;">
              You still have <strong>1 free scan remaining</strong> this month. If you've noticed any changes, you can run another scan right now.
            </p>
            <a href="${scanUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 12px;">
              Use Your Free Scan →
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
              This is a one-time notification based on your scan activity. No spam, ever.
            </p>
          </div>
        `,
      };

    case 2:
      return {
        subject: 'Is your pet doing better?',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <img src="https://checkpet.vet/checkpet-logo.png" alt="CheckPet" style="width: 40px; height: 40px; border-radius: 8px; margin-bottom: 16px;" />
            <h2 style="color: #0f172a; margin-bottom: 8px;">Quick check-in 🐾</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 15px;">
              A week ago, you scanned your pet's symptoms on CheckPet. We hope everything's improving!
            </p>
            <p style="color: #475569; line-height: 1.6; font-size: 15px;">
              If symptoms have changed or you're still worried, a quick follow-up scan can show you what to watch for next. Unlimited scans are just <strong>$9.99/month</strong> for ongoing peace of mind.
            </p>
            <a href="${scanUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 12px;">
              Check My Pet Again →
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
              You're receiving this because you used CheckPet. Reply STOP to unsubscribe.
            </p>
          </div>
        `,
      };

    case 3:
      return {
        subject: 'Your free scans just reset 🎉',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <img src="https://checkpet.vet/checkpet-logo.png" alt="CheckPet" style="width: 40px; height: 40px; border-radius: 8px; margin-bottom: 16px;" />
            <h2 style="color: #0f172a; margin-bottom: 8px;">Your free scans are back!</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 15px;">
              Good news — your monthly free scans have reset. You've got <strong>2 free AI pet symptom scans</strong> waiting for you.
            </p>
            <p style="color: #475569; line-height: 1.6; font-size: 15px;">
              Your pet's health doesn't take days off. Whether it's a new concern or a follow-up on something from last month, we're here.
            </p>
            <a href="${scanUrl}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 12px;">
              Run a Free Scan →
            </a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
              You're receiving this because you used CheckPet. Reply STOP to unsubscribe.
            </p>
          </div>
        `,
      };

    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NurtureRequest = await req.json();

    if (body.action === 'schedule') {
      // Enroll user in nurture sequence
      const { error } = await supabase.from('email_nurture').upsert(
        {
          user_id: body.userId,
          email: body.email,
          enrolled_at: new Date().toISOString(),
          next_email_sequence: 1,
          next_send_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // Day 3
          status: 'active',
          utm_source: body.utmParams?.utm_source || null,
          utm_campaign: body.utmParams?.utm_campaign || null,
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        console.error('[Nurture] Schedule error:', error);
        // Don't fail the main auth flow — nurture is best-effort
        return NextResponse.json({ scheduled: false, error: error.message });
      }

      return NextResponse.json({ scheduled: true });
    }

    if (body.action === 'send') {
      // Find users due for their next nurture email
      const now = new Date().toISOString();
      const { data: dueUsers, error } = await supabase
        .from('email_nurture')
        .select('*')
        .eq('status', 'active')
        .lte('next_send_at', now)
        .limit(50);

      if (error || !dueUsers) {
        return NextResponse.json({ sent: 0, error: error?.message });
      }

      let sent = 0;
      for (const user of dueUsers) {
        const template = getEmailTemplate(user.next_email_sequence, user.email);
        if (!template) {
          // Sequence complete
          await supabase
            .from('email_nurture')
            .update({ status: 'completed' })
            .eq('user_id', user.user_id);
          continue;
        }

        const result = await sendEmail(user.email, template.subject, template.html);
        if (result) {
          sent++;

          // Schedule next email
          const nextSequence = user.next_email_sequence + 1;
          const daysBetween = nextSequence === 2 ? 4 : 7; // Day 3→7 = 4 days, Day 7→14 = 7 days
          const nextSendAt = new Date(Date.now() + daysBetween * 24 * 60 * 60 * 1000).toISOString();

          await supabase
            .from('email_nurture')
            .update({
              next_email_sequence: nextSequence,
              next_send_at: nextSequence > 3 ? null : nextSendAt,
              status: nextSequence > 3 ? 'completed' : 'active',
              last_sent_at: new Date().toISOString(),
            })
            .eq('user_id', user.user_id);
        }
      }

      return NextResponse.json({ sent });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Nurture] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET handler for Vercel Cron Jobs.
 * Vercel sends GET requests with `Authorization: Bearer <CRON_SECRET>`.
 * This triggers the daily send of due nurture emails.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Reuse the POST send logic
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const now = new Date().toISOString();
    const { data: dueUsers, error } = await supabase
      .from('email_nurture')
      .select('*')
      .eq('status', 'active')
      .lte('next_send_at', now)
      .limit(50);

    if (error || !dueUsers) {
      return NextResponse.json({ sent: 0, error: error?.message });
    }

    let sent = 0;
    for (const user of dueUsers) {
      const template = getEmailTemplate(user.next_email_sequence, user.email);
      if (!template) {
        await supabase
          .from('email_nurture')
          .update({ status: 'completed' })
          .eq('user_id', user.user_id);
        continue;
      }

      const result = await sendEmail(user.email, template.subject, template.html);
      if (result) {
        sent++;
        const nextSequence = user.next_email_sequence + 1;
        const daysBetween = nextSequence === 2 ? 4 : 7;
        const nextSendAt = new Date(Date.now() + daysBetween * 24 * 60 * 60 * 1000).toISOString();

        await supabase
          .from('email_nurture')
          .update({
            next_email_sequence: nextSequence,
            next_send_at: nextSequence > 3 ? null : nextSendAt,
            status: nextSequence > 3 ? 'completed' : 'active',
            last_sent_at: new Date().toISOString(),
          })
          .eq('user_id', user.user_id);
      }
    }

    return NextResponse.json({ sent, triggered_by: 'cron' });
  } catch (error: any) {
    console.error('[Nurture][Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
