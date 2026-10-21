'use client';

import { useEffect, useState } from 'react';

/**
 * "Add to home screen", offered once.
 *
 * The service worker and manifest have been here since the start, so the
 * site already installs and already works underground — and essentially
 * nobody discovered it, because browsers stopped showing install affordances
 * on their own. For a tool you use twice a day on a platform with no signal,
 * being an icon on the home screen is most of the value.
 *
 * Two different mechanisms, because the platforms disagree:
 *   Chrome and Edge fire `beforeinstallprompt`, which can be deferred and
 *   replayed from a real tap. That gives a genuine install button.
 *   iOS Safari fires nothing and exposes no API. The only route is Share →
 *   Add to Home Screen, so there it is a short instruction instead of a
 *   button that could not work.
 *
 * Dismissal is permanent and stored locally. A prompt that returns after
 * being refused is the reason people hate prompts.
 */

const DISMISSED_KEY = 'nc.install.dismissed';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return undefined;

    // Already installed: standalone display means it launched from the home
    // screen, so suggesting installation again would be nonsense.
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return undefined;

    const onPrompt = (e: Event) => {
      // Must be prevented to stop Chrome's own mini-infobar, and kept so the
      // real prompt can be replayed from a user gesture later.
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    /*
      iOS detection by capability, not by user-agent string: iPadOS reports
      itself as a Mac, and Chrome on iOS is Safari underneath. A touch-capable
      device with Apple's vendor string and no beforeinstallprompt support is
      the honest test.
    */
    const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isApple && !('onbeforeinstallprompt' in window)) {
      // Delayed so it never competes with the first paint or the location
      // permission dialog.
      const t = setTimeout(() => setIosHint(true), 4000);
      return () => { window.removeEventListener('beforeinstallprompt', onPrompt); clearTimeout(t); };
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDeferred(null);
    setIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // Either way the question has been asked and should not be asked again.
    dismiss();
  };

  if (!deferred && !iosHint) return null;

  return (
    <div
      role="complementary"
      aria-label="Install this app"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pb-3"
      style={{ animation: 'slide-up 320ms ease-out both' }}
    >
      <div
        className="mx-auto flex max-w-[34rem] items-center gap-3 px-3.5 py-3"
        style={{
          borderRadius: 'calc(var(--r-md) * 2)',
          background: 'var(--raised)',
          border: '1px solid var(--rule)',
          boxShadow: '0 12px 40px rgba(0,0,0,.35)',
        }}
      >
        <AppMark />

        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold leading-tight">
            Add Namma Commute to your home screen
          </p>
          <p className="mt-0.5 text-[0.75rem] leading-snug" style={{ color: 'var(--muted)' }}>
            {iosHint
              ? 'Tap Share, then “Add to Home Screen”. Works underground, no signal needed.'
              : 'Opens like an app and works underground, with no signal.'}
          </p>
        </div>

        {deferred && (
          <button
            type="button"
            onClick={install}
            className="tap shrink-0 px-3.5 text-[0.8125rem] font-semibold"
            style={{
              borderRadius: 'var(--r-md)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
            }}
          >
            Install
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="tap flex w-9 shrink-0 items-center justify-center"
          style={{ color: 'var(--muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** The roundel, small. */
function AppMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <rect width="48" height="48" rx="11" fill="#0b0710" />
      <g transform="rotate(-90 24 24)" strokeWidth="5.6" strokeLinecap="round" fill="none">
        <circle cx="24" cy="24" r="16.6" strokeDasharray="28.9 75.4" stroke="#c264d8" />
        <circle cx="24" cy="24" r="16.6" strokeDasharray="28.9 75.4" stroke="#45cf78" strokeDashoffset="-34.75" />
        <circle cx="24" cy="24" r="16.6" strokeDasharray="28.9 75.4" stroke="#e8c552" strokeDashoffset="-69.5" />
      </g>
      <g fill="#ffffff">
        <circle cx="24" cy="17.1" r="3.5" />
        <path d="M16.9 29.6c0-3.9 3.2-7.1 7.1-7.1s7.1 3.2 7.1 7.1z" />
        <rect x="13.2" y="31.4" width="21.6" height="3.3" rx="1.65" />
      </g>
    </svg>
  );
}
