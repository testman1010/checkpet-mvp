'use client';

/**
 * Willingness-to-pay probe (fake door) for a paid "vet handoff summary".
 *
 * WHY THIS AND NOT A PAYWALL
 * At ~170 completed analyses/month, a real paywall split test yields 2-4 payers per arm per
 * month — unreadable for 8-12 months — while adding friction to a funnel whose binding
 * constraint is the 5% CTA click-through, not monetization. A probe measures intent at a
 * stated price with no checkout, no funnel damage, and a signal rate an order of magnitude
 * higher than payment conversion would be.
 *
 * WHY THIS OFFER
 * The free article already answers "is this serious?", so charging for the analysis competes
 * with our own content. A structured document to hand the vet is something the article cannot
 * substitute for — and 115 people over 8 weeks returned to the same guide for one ongoing
 * problem, which is the audience for it.
 *
 * HONESTY
 * This is NOT a simulated purchase. The CTA reads "I'd pay for this", never "Buy". On click we
 * say plainly that it does not exist yet and why we are asking. No fake checkout, no fake error,
 * no charge. Email capture is optional and clearly labelled.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { FileText, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';

/** Fallback when the `paid-offer-probe` flag is absent. Flag payload can override both. */
const DEFAULT_PRICE_USD = 1.99;
const DEFAULT_ENABLED = true;

interface VetHandoffOfferProps {
    urgencyLevel?: string;
    confidence?: number | null;
    primaryCondition?: string;
    isEmergency?: boolean;
    caseId?: string | null;
    species?: string;
    /** Called on purchase intent so the result screen counts it as engagement, not abandonment. */
    onEngaged?: () => void;
}

type Stage = 'offer' | 'revealed' | 'submitted';

export function VetHandoffOffer({
    urgencyLevel,
    confidence,
    primaryCondition,
    isEmergency,
    caseId,
    species,
    onEngaged,
}: VetHandoffOfferProps) {
    const posthog = usePostHog();
    const [stage, setStage] = useState<Stage>('offer');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const viewedRef = useRef(false);

    // Price and kill-switch are flag-controlled so the probe can be retuned or turned off
    // without a deploy. Absent flag => defaults above, so this works with no PostHog setup.
    const flagPayload = posthog?.getFeatureFlagPayload?.('paid-offer-probe') as
        | { price_usd?: number; enabled?: boolean }
        | undefined;
    const price = typeof flagPayload?.price_usd === 'number' ? flagPayload.price_usd : DEFAULT_PRICE_USD;
    const enabled = typeof flagPayload?.enabled === 'boolean' ? flagPayload.enabled : DEFAULT_ENABLED;

    const baseProps = useCallback(() => ({
        price_usd: price,
        offer: 'vet_handoff_summary',
        urgency_level: urgencyLevel ?? null,
        confidence: confidence ?? null,
        primary_condition: primaryCondition ?? null,
        is_emergency: !!isEmergency,
        case_id: caseId ?? null,
        species: species ?? null,
    }), [price, urgencyLevel, confidence, primaryCondition, isEmergency, caseId, species]);

    // Impression — the denominator for intent rate. Fires once, at 50% visibility.
    useEffect(() => {
        if (!enabled || !cardRef.current || viewedRef.current) return;
        const el = cardRef.current;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !viewedRef.current) {
                    viewedRef.current = true;
                    posthog?.capture('paid_offer_viewed', baseProps());
                }
            },
            { threshold: 0.5 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [enabled, posthog, baseProps]);

    if (!enabled) return null;

    const handleIntent = () => {
        posthog?.capture('paid_offer_clicked', baseProps());
        onEngaged?.();
        setStage('revealed');
    };

    const handleEmailSubmit = async () => {
        const trimmed = email.trim();
        if (!trimmed || !trimmed.includes('@') || trimmed.length < 5) {
            setEmailError('Enter an email address so we can reach you.');
            return;
        }
        setEmailError(null);
        setSaving(true);
        try {
            const { error } = await supabase.from('waitlist').insert([{
                email: trimmed,
                source: 'vet_handoff_probe',
                report_data: {
                    price_usd: price,
                    urgency_level: urgencyLevel ?? null,
                    primary_condition: primaryCondition ?? null,
                    confidence: confidence ?? null,
                    case_id: caseId ?? null,
                },
            }]);
            if (error) {
                // Surface it rather than silently dropping the signal. (The one PostHog thumbs-down
                // with no result_ratings row was a live test deleted on request, not a failed insert.)
                console.error('[vet-handoff-probe] waitlist insert failed:', error);
                setEmailError("That didn't save. Try again in a moment.");
                posthog?.capture('paid_offer_email_failed', { ...baseProps(), error: error.message });
                return;
            }
            posthog?.capture('paid_offer_email_submitted', baseProps());
            setStage('submitted');
        } catch (err) {
            console.error('[vet-handoff-probe] unexpected error:', err);
            setEmailError("That didn't save. Try again in a moment.");
        } finally {
            setSaving(false);
        }
    };

    const priceLabel = `$${price.toFixed(2)}`;

    return (
        <div
            ref={cardRef}
            className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200">
                    <FileText className="h-4 w-4 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">
                        Vet handoff summary &middot; {priceLabel}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        A one-page PDF of this assessment written for your vet — the symptoms you
                        described, what we ruled in and out, and the clinical references behind it.
                        Bring it with you so nothing gets missed.
                    </p>

                    {stage === 'offer' && (
                        <Button
                            type="button"
                            onClick={handleIntent}
                            className="mt-3 h-10 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98]"
                        >
                            I&apos;d pay {priceLabel} for this
                        </Button>
                    )}

                    {stage === 'revealed' && (
                        <div className="mt-3 space-y-3">
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                                <p className="text-xs leading-relaxed text-amber-900">
                                    <span className="font-semibold">We haven&apos;t built this yet.</span>{' '}
                                    You haven&apos;t been charged and there&apos;s nothing to buy — we&apos;re
                                    checking whether it&apos;s worth building before we build it. Thanks for
                                    telling us.
                                </p>
                            </div>
                            <div>
                                <label htmlFor="handoff-email" className="text-xs font-medium text-slate-600">
                                    Want an email when it exists? Optional.
                                </label>
                                <div className="mt-1.5 flex gap-2">
                                    <Input
                                        id="handoff-email"
                                        type="email"
                                        inputMode="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="h-10 flex-1 text-sm"
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleEmailSubmit}
                                        disabled={saving}
                                        className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Notify me'}
                                    </Button>
                                </div>
                                {emailError && (
                                    <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                                        {emailError}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {stage === 'submitted' && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                            <Check className="h-4 w-4 shrink-0 text-green-600" />
                            <p className="text-xs font-medium text-green-900">
                                Got it — we&apos;ll email you if we build this.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
