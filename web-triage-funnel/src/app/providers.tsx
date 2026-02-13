'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

import { useEffect } from 'react';

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_placeholder', {
                api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
                person_profiles: 'identified_only',
                capture_pageview: true
            });
        }
    }, []);

    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
