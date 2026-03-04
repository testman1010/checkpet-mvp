/**
 * UTM parameter capture and persistence for ad attribution.
 *
 * On landing, captures utm_source, utm_medium, utm_campaign, utm_content
 * from the URL and stores them in localStorage. This lets us tie Meta's
 * reported ad data to our own Supabase user records.
 */

const UTM_STORAGE_KEY = 'checkpet_utm';

export interface UtmParams {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
}

/**
 * Capture UTM parameters from the current URL and persist to localStorage.
 * Only overwrites if new UTMs are present (preserves original attribution).
 */
export function captureUtmParams(): UtmParams | null {
    if (typeof window === 'undefined') return null;

    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');

    // Only capture if there's at least a utm_source present
    if (!utmSource) return getUtmParams();

    const utmParams: UtmParams = {
        utm_source: utmSource || undefined,
        utm_medium: params.get('utm_medium') || undefined,
        utm_campaign: params.get('utm_campaign') || undefined,
        utm_content: params.get('utm_content') || undefined,
    };

    try {
        localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmParams));
    } catch (e) {
        console.warn('[UTM] Failed to persist UTM params', e);
    }

    return utmParams;
}

/**
 * Retrieve stored UTM parameters.
 */
export function getUtmParams(): UtmParams | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = localStorage.getItem(UTM_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as UtmParams;
    } catch {
        return null;
    }
}

/**
 * Clear stored UTM parameters (e.g. after attribution is recorded server-side).
 */
export function clearUtmParams(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(UTM_STORAGE_KEY);
    } catch {
        // no-op
    }
}
