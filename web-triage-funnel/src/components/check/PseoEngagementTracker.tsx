'use client';

import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';

/**
 * Tracks scroll depth (25%, 50%, 75%, 100%) and time-on-page for pSEO pages.
 * Fires PostHog events:
 *   - pseo_scroll_depth: { depth: 25|50|75|100, species, symptom }
 *   - pseo_time_on_page: { seconds, species, symptom } (on page unload)
 */
export function PseoEngagementTracker({ species, symptom }: { species: string; symptom: string }) {
    const posthog = usePostHog();
    const firedDepths = useRef(new Set<number>());
    const pageLoadTime = useRef(Date.now());

    useEffect(() => {
        const thresholds = [25, 50, 75, 100];

        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (docHeight <= 0) return;

            const pct = Math.round((scrollTop / docHeight) * 100);

            for (const t of thresholds) {
                if (pct >= t && !firedDepths.current.has(t)) {
                    firedDepths.current.add(t);
                    posthog?.capture('pseo_scroll_depth', {
                        depth: t,
                        species,
                        symptom,
                    });
                }
            }
        };

        const handleUnload = () => {
            const seconds = Math.round((Date.now() - pageLoadTime.current) / 1000);
            // Use sendBeacon via PostHog for reliable unload tracking
            posthog?.capture('pseo_time_on_page', {
                seconds,
                species,
                symptom,
                max_scroll_depth: Math.max(...Array.from(firedDepths.current), 0),
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('beforeunload', handleUnload);

        // Fire initial check in case page is short and already scrolled
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [posthog, species, symptom]);

    // This component renders nothing — it's purely behavioral
    return null;
}
