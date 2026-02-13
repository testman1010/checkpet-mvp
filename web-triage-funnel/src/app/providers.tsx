'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

import { useEffect } from 'react';

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            posthog.init('phc_HiWhs0jxGUSDyDMdAI6XwrALmA6iRQl8XhYyLfmGKti', {
                api_host: 'https://us.i.posthog.com',
                person_profiles: 'identified_only',
                capture_pageview: true
            });
        }
    }, []);

    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
