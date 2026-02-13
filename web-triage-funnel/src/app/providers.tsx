'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// Initialize PostHog Client
if (typeof window !== 'undefined') {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_placeholder', {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true, // Re-enabled for debugging
        loaded: (posthog) => {
            if (process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) posthog.debug()
        }
    });
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
