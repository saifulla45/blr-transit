'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker so the app keeps working underground.
 *
 * Registration is deferred to the load event: fetching and installing it
 * competes with the first paint otherwise, and offline matters on the *next*
 * visit, not this one.
 */
export function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline is an enhancement; a failure here must not break the page.
      });
    };

    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
