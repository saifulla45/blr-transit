'use client';

import { TicketIcon } from './icons';

/**
 * Header shortcut to buying a ticket from this station.
 *
 * The WhatsApp ticket needs a destination, so this takes you to the fare
 * panel with its station picker already focused. Focus happens inside the
 * tap — iOS only raises the keyboard for a focus made by a user gesture.
 */
export function BuyTicketButton() {
  const onClick = () => {
    const panel = document.getElementById('fare');
    if (!panel) return;
    // An instant jump, not a smooth one: iOS scrolls the focused input above
    // the keyboard itself, and an animation would fight that.
    panel.scrollIntoView({ block: 'center' });
    panel.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-bold"
      style={{ background: 'var(--gold-gradient)', color: '#ffffff', boxShadow: '0 10px 24px -12px rgba(0,0,0,.55)' }}
    >
      <TicketIcon size={15} /> Buy ticket
    </button>
  );
}
