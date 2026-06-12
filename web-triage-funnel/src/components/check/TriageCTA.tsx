'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';

/* ────────────────────────────────────────────────────────────────────────────
 *  Shared hook — fetches scan count for social proof (cached in sessionStorage)
 * ──────────────────────────────────────────────────────────────────────────── */
function useScanCount(fallback = 75) {
    const [count, setCount] = useState<number>(fallback);
    useEffect(() => {
        const cached = sessionStorage.getItem('checkpet_scan_count');
        if (cached) { setCount(parseInt(cached, 10)); return; }
        fetch('/api/stats/scan-count')
            .then(r => r.json())
            .then(d => {
                const n = d.count ?? fallback;
                setCount(n);
                sessionStorage.setItem('checkpet_scan_count', String(n));
            })
            .catch(() => { /* keep fallback */ });
    }, [fallback]);
    return count;
}

/* ────────────────────────────────────────────────────────────────────────────
 *  Shared navigation helper — builds URL params and pushes to homepage triage
 * ──────────────────────────────────────────────────────────────────────────── */
function useTriageNav() {
    const router = useRouter();
    return (species: string, symptom: string, description?: string, autostart?: boolean) => {
        const params = new URLSearchParams({
            species: species.toLowerCase(),
            symptom,
            description: description || `My ${species} is showing signs of ${symptom}`,
        });
        if (autostart) params.set('autostart', '1');
        router.push(`/?${params.toString()}`);
    };
}

/* ════════════════════════════════════════════════════════════════════════════
 *  CONCEPT B — Hero CTA: "One-Click Smart Prefill"
 *
 *  The system already knows the symptom from the page. User just confirms.
 *  Textarea hidden behind a collapsible accordion for power users.
 * ════════════════════════════════════════════════════════════════════════════ */

interface TriageCTAProps {
    species: string;
    symptom: string;
    symptomTitle: string;
}

export function TriageCTA({ species, symptom, symptomTitle }: TriageCTAProps) {
    const posthog = usePostHog();
    const navigate = useTriageNav();
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasTyped, setHasTyped] = useState(false);
    const [hasFocused, setHasFocused] = useState(false);
    const ctaRef = useRef<HTMLDivElement>(null);
    const viewedRef = useRef(false);

    // Capitalise species for display
    const speciesLabel = species.charAt(0).toUpperCase() + species.slice(1);
    // Clean symptom for pill display
    const symptomLabel = symptom.replace(/\b\w/g, (c) => c.toUpperCase());

    /* ── PostHog instrumentation ── */
    useEffect(() => {
        if (!ctaRef.current || viewedRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !viewedRef.current) {
                    viewedRef.current = true;
                    posthog?.capture('pseo_cta_viewed', {
                        species, symptom, symptom_title: symptomTitle,
                    });
                }
            },
            { threshold: 0.5 },
        );
        observer.observe(ctaRef.current);
        return () => observer.disconnect();
    }, [posthog, species, symptom, symptomTitle]);

    const handleDescChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setDescription(e.target.value);
            if (!hasTyped && e.target.value.length > 0) {
                setHasTyped(true);
                posthog?.capture('pseo_cta_description_typed', { species, symptom });
            }
        },
        [hasTyped, posthog, species, symptom],
    );

    const handleGo = () => {
        setLoading(true);
        posthog?.capture('pseo_cta_clicked', {
            species, symptom, symptom_title: symptomTitle,
            has_description: description.length > 0,
            description_length: description.length,
            source: 'hero',
            autostart: true,
        });
        navigate(species, symptom, description || undefined, true);
    };

    const handleFocus = () => {
        if (!hasFocused) {
            setHasFocused(true);
            posthog?.capture('pseo_cta_input_focused', { species, symptom });
        }
    };

    const scanCount = useScanCount();

    return (
        <div ref={ctaRef} className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">

                {/* Curiosity hook */}
                <p className="text-lg font-bold text-slate-900 leading-snug">
                    Could this be serious?
                </p>
                <p className="text-sm text-slate-600 leading-relaxed -mt-2">
                    Find out if <span className="font-semibold text-slate-800">{symptomLabel.toLowerCase()}</span> needs
                    emergency care — takes 30 seconds.
                </p>

                {/* Symptom chip */}
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium">
                        {speciesLabel} · {symptomLabel}
                    </span>
                </div>

                {/* Inline symptom input — always visible so the page IS the tool */}
                <textarea
                    placeholder={`What are you seeing? e.g. started 2 hours ago, getting worse...`}
                    className="w-full text-sm p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 resize-none"
                    value={description}
                    onChange={handleDescChange}
                    onFocus={handleFocus}
                    rows={2}
                />

                {/* Primary action — starts the analysis immediately on arrival */}
                <button
                    onClick={handleGo}
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[15px] shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            Analyze Symptoms Free
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>

                {/* Social proof footer */}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Free · No signup · {scanCount}+ checks completed</span>
                </div>
            </div>
        </div>
    );
}


/* ════════════════════════════════════════════════════════════════════════════
 *  CONCEPT C — Mid-Article Urgency Banner
 *
 *  Compact inline strip with a left urgency accent. Placed after the first
 *  content section to provide a second touchpoint without interrupting flow.
 * ════════════════════════════════════════════════════════════════════════════ */

interface UrgencyBannerProps {
    species: string;
    symptom: string;
    /** 'high' = red accent, 'moderate' = amber, 'low' = green */
    urgency?: 'high' | 'moderate' | 'low';
}

const ACCENT_COLORS = {
    high: 'border-l-red-500',
    moderate: 'border-l-amber-400',
    low: 'border-l-green-500',
} as const;

export function UrgencyBanner({ species, symptom, urgency = 'moderate' }: UrgencyBannerProps) {
    const posthog = usePostHog();
    const navigate = useTriageNav();
    const [loading, setLoading] = useState(false);
    const bannerRef = useRef<HTMLDivElement>(null);
    const viewedRef = useRef(false);

    useEffect(() => {
        if (!bannerRef.current || viewedRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !viewedRef.current) {
                    viewedRef.current = true;
                    posthog?.capture('pseo_urgency_banner_viewed', { species, symptom, urgency });
                }
            },
            { threshold: 0.5 },
        );
        observer.observe(bannerRef.current);
        return () => observer.disconnect();
    }, [posthog, species, symptom, urgency]);

    const handleClick = () => {
        setLoading(true);
        posthog?.capture('pseo_urgency_banner_clicked', { species, symptom, urgency });
        navigate(species, symptom);
    };

    return (
        <div
            ref={bannerRef}
            className={`bg-white rounded-xl border border-slate-200 border-l-4 ${ACCENT_COLORS[urgency]} shadow-sm px-4 py-3.5 flex items-center gap-4 not-prose`}
        >
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-snug">
                    Not sure how serious this is?
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                    Get a free severity check in 30 seconds
                </p>
            </div>
            <button
                onClick={handleClick}
                disabled={loading}
                className="shrink-0 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.97] disabled:opacity-50 flex items-center gap-1.5"
            >
                {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <>
                        Check severity
                        <ArrowRight className="w-3 h-3" />
                    </>
                )}
            </button>
        </div>
    );
}


/* ════════════════════════════════════════════════════════════════════════════
 *  Sticky Mobile Bottom CTA
 *
 *  Appears when user scrolls past the hero section. md:hidden so it only
 *  shows on mobile. Matches the compact button style.
 * ════════════════════════════════════════════════════════════════════════════ */

export function StickyMobileCTA({ species, symptom }: { species: string; symptom: string }) {
    const posthog = usePostHog();
    const navigate = useTriageNav();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleScroll = () => setVisible(window.scrollY > 500);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleClick = () => {
        setLoading(true);
        posthog?.capture('pseo_sticky_cta_clicked', { species, symptom });
        navigate(species, symptom);
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 z-50 px-4 py-3 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] transition-all duration-300 md:hidden ${
                visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
            }`}
        >
            <button
                onClick={handleClick}
                disabled={loading}
                className="w-full h-11 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <>
                        Is this an emergency? Check now
                        <ArrowRight className="w-3.5 h-3.5" />
                    </>
                )}
            </button>
        </div>
    );
}
