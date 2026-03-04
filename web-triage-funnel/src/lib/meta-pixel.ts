/**
 * Meta Pixel helper utilities for CheckPet funnel tracking.
 *
 * Custom events mapped to the PMF validation funnel:
 *   ViewContent  → Landing page loaded (automatic via pixel base code)
 *   StartTrial   → First free scan completed
 *   Lead         → Email submitted for second scan unlock
 *   SecondScan   → Second free scan completed (custom event)
 *   InitiateCheckout → User hits the paywall / pricing screen
 *   Purchase     → Payment completed ($9.99/mo or $3.99 one-time)
 */

// Extend window to include fbq
declare global {
  interface Window {
    fbq: (...args: any[]) => void;
    _fbq: (...args: any[]) => void;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';

/**
 * Fire a standard Meta Pixel event (e.g. 'Lead', 'Purchase', 'InitiateCheckout').
 * Falls back silently if fbq is not loaded (dev, ad-blockers).
 */
export function trackMetaEvent(
  eventName: string,
  params?: Record<string, any>
) {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return;
  // Skip on localhost
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    console.log(`[MetaPixel][DEV] ${eventName}`, params);
    return;
  }

  if (params) {
    window.fbq('track', eventName, params);
  } else {
    window.fbq('track', eventName);
  }
}

/**
 * Fire a custom (non-standard) Meta Pixel event.
 */
export function trackMetaCustomEvent(
  eventName: string,
  params?: Record<string, any>
) {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq !== 'function') return;
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    console.log(`[MetaPixel][DEV][Custom] ${eventName}`, params);
    return;
  }

  if (params) {
    window.fbq('trackCustom', eventName, params);
  } else {
    window.fbq('trackCustom', eventName);
  }
}

// ---- Convenience wrappers for each funnel step ----

/** First free scan completed — top-of-funnel engagement */
export function trackStartTrial(species?: string) {
  trackMetaCustomEvent('StartTrial', { content_category: species || 'unknown' });
}

/** Email submitted to unlock second scan — qualified lead */
export function trackLead() {
  trackMetaEvent('Lead', { content_name: 'email_capture_scan2' });
}

/** Second free scan completed */
export function trackSecondScan() {
  trackMetaCustomEvent('SecondScan');
}

/** User hits the paywall / selects a payment option */
export function trackInitiateCheckout(type?: 'emergency_scan' | 'subscription') {
  trackMetaEvent('InitiateCheckout', { content_name: type || 'paywall' });
}

/** Payment completed — fired client-side as backup (CAPI is primary) */
export function trackPurchase(value: number, type: 'subscription' | 'emergency_scan') {
  trackMetaEvent('Purchase', {
    value,
    currency: 'USD',
    content_name: type,
  });
}
