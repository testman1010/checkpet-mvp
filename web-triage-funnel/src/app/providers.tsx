'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

import { useEffect } from 'react';

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_placeholder', {
                api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
                person_profiles: 'always',
                capture_pageview: true,
                loaded: (posthog_instance) => {
                    const urlParams = new URLSearchParams(window.location.search);
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || urlParams.get('ph_optout') === 'true') {
                        posthog_instance.opt_out_capturing();
                    }
                },
            });
        }
    }, []);

    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
