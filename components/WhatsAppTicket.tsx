'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { WHATSAPP_TICKET_URL, formatRupees, whatsappTicketLink } from '@/lib/fares';
import { detectPlatform, type Platform } from '@/lib/lastmile';
import { WhatsAppIcon } from './icons';

/**
 * Buy this journey's QR ticket on BMRCL's WhatsApp counter.
 *
 * The chatbot takes no journey from a link — it starts from "Hi" and asks
 * for both stations — so the card names the two to pick and the fare to
 * expect, and the rider never has to remember them mid-chat.
 */
export function WhatsAppTicket({
  from, to, fare,
}: { from: string; to: string; fare?: number }) {
  // The server cannot see the user agent, so it renders wa.me and the
  // client swaps in the app link.
  const platform = useSyncExternalStore<Platform>(
    noSubscribe, () => detectPlatform(navigator.userAgent), () => 'other',
  );
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; listeners: AbortController } | null>(null);
  const cancelPending = () => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    pending.current.listeners.abort();
    pending.current = null;
  };
  useEffect(() => cancelPending, []);

  /*
    iOS cannot fall back from a custom scheme on its own: if the page is
    still showing after a moment, WhatsApp did not open, so go to wa.me.
    One pending fallback at a time — a second tap replaces the first — and
    leaving the page (the app opened) cancels it. The wait is generous
    because Safari may first ask "Open in WhatsApp?" with the page visible.
  */
  const onTap = () => {
    if (platform !== 'ios') return;
    cancelPending();
    const listeners = new AbortController();
    document.addEventListener('visibilitychange', cancelPending, { signal: listeners.signal });
    window.addEventListener('pagehide', cancelPending, { signal: listeners.signal });
    const timer = setTimeout(() => {
      const stillHere = document.visibilityState === 'visible';
      cancelPending();
      if (stillHere) window.location.href = WHATSAPP_TICKET_URL;
    }, 2500);
    pending.current = { timer, listeners };
  };

  return (
    <a
      href={whatsappTicketLink(platform)}
      rel="noreferrer"
      onClick={onTap}
      className="press tap mt-3 block p-3.5"
      style={{
        borderRadius: 'var(--r-md)',
        border: '1px solid color-mix(in srgb, var(--good) 40%, transparent)',
        background: 'color-mix(in srgb, var(--good) 9%, transparent)',
        color: 'var(--ink)',
      }}
      aria-label={`Buy a QR ticket from ${from} to ${to} on BMRCL's WhatsApp`}
    >
      <span className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'color-mix(in srgb, var(--good) 16%, transparent)' }}>
          <WhatsAppIcon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-bold leading-tight">Buy QR ticket on WhatsApp</span>
          <span className="mt-0.5 block text-[0.75rem] leading-snug" style={{ color: 'var(--muted)' }}>
            {from} → {to}
          </span>
        </span>
        {fare !== undefined && (
          <span className="num shrink-0 text-[1.125rem] font-bold">{formatRupees(fare)}</span>
        )}
      </span>
      <span className="mt-2.5 block text-[0.6875rem] leading-relaxed" style={{ color: 'var(--muted)' }}>
        Opens BMRCL&rsquo;s official chat (+91 81055 56677) with &ldquo;Hi&rdquo; ready to send.
        Choose <strong style={{ color: 'var(--ink)' }}>Buy QR ticket</strong>, pick these two
        stations, pay by UPI — the QR arrives in the chat to scan at the gate.
      </span>
    </a>
  );
}

const noSubscribe = () => () => {};
