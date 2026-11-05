/**
 * What a journey actually costs, and whether waiting would make it cheaper.
 *
 * BMRCL prices the same trip three ways: token and QR at the headline fare, a
 * smart card 5% cheaper at peak and 10% cheaper off-peak. Peak is 08:00–12:00
 * and 16:00–21:00 on weekdays and Mondays; Sundays and public holidays are
 * off-peak all day.
 */
import type { FareOption, FareWindow, FareWindows, Minutes, ServicePattern } from '@/types/transit';

/** [base, smartCardPeak, smartCardOffPeak] */
export type FareTuple = [number, number, number];

/** Whether the given moment falls in a peak window. */
export function isPeak(
  windows: FareWindows, pattern: ServicePattern, minutes: Minutes,
): boolean {
  const day = windows[pattern] ?? [];
  // Windows are half-open: a 12:00 boundary belongs to the afternoon off-peak.
  return day.some((w) => w.peak && minutes >= w.from && minutes < w.to);
}

/** When the current window ends — used for "wait N minutes and save". */
export function currentWindowEnd(
  windows: FareWindows, pattern: ServicePattern, minutes: Minutes,
): FareWindow | undefined {
  return (windows[pattern] ?? []).find((w) => minutes >= w.from && minutes < w.to);
}

export function formatRupees(amount: number): string {
  // Smart-card prices carry 50 paise; whole rupees should not show ".00".
  return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
}

/**
 * The ways to pay for this journey right now, cheapest last so the UI can lead
 * with what most people use and end on the saving.
 */
export function fareOptions(fare: FareTuple, peak: boolean): FareOption[] {
  const [base, scPeak, scOff] = fare;
  const smartcard = peak ? scPeak : scOff;
  const saving = base - smartcard;

  return [
    { media: 'token', label: 'Token', amount: base },
    { media: 'qr', label: 'QR ticket', amount: base },
    {
      media: 'smartcard',
      label: 'Smart card',
      amount: smartcard,
      note: saving > 0 ? `saves ${formatRupees(saving)}` : undefined,
    },
  ];
}

/**
 * What the same journey would cost on a smart card at the other time of day.
 * Returns null when there is nothing to gain by waiting.
 */
export function offPeakSaving(fare: FareTuple, peak: boolean): number | null {
  if (!peak) return null;
  const diff = fare[1] - fare[2];
  return diff > 0 ? diff : null;
}

/**
 * BMRCL's WhatsApp QR ticket counter.
 *
 * Send "Hi", pick origin and destination, pay by UPI, and the QR arrives in
 * the chat to scan at the gate. No app install, no queue.
 *
 * Deliberately NOT advertised as cheaper. Secondary reporting describes a 5%
 * WhatsApp discount, but the fares feed prices QR identically to a token --
 * see the FareMatrix comment -- and that table is rendered directly above
 * this link. Claiming a saving the adjacent numbers contradict is worse than
 * claiming nothing. The smart card is where the real discount is, and the
 * fare list already shows it.
 *
 * The web link is wa.me. On a phone it is not enough on its own: when
 * WhatsApp's universal link is skipped (in-app browsers, or after someone
 * once chose "open in Safari") it lands on a "Continue to chat" page instead
 * of the app, which reads as the button not working. whatsappTicketLink()
 * goes to the app directly and keeps wa.me as the fallback.
 */
export const WHATSAPP_TICKET_NUMBER = '8105556677';
export const WHATSAPP_TICKET_URL = `https://wa.me/91${WHATSAPP_TICKET_NUMBER}?text=Hi`;

/**
 * The ticket link for this platform. Android asks for WhatsApp by package and
 * falls back to wa.me itself; iPhone uses WhatsApp's own scheme, with the
 * caller falling back to wa.me if nothing opened (iOS has no fallback field).
 */
export function whatsappTicketLink(platform: 'android' | 'ios' | 'other'): string {
  const query = `phone=91${WHATSAPP_TICKET_NUMBER}&text=Hi`;
  if (platform === 'android') {
    return `intent://send?${query}#Intent;scheme=whatsapp;package=com.whatsapp;`
      + `S.browser_fallback_url=${encodeURIComponent(WHATSAPP_TICKET_URL)};end`;
  }
  if (platform === 'ios') return `whatsapp://send?${query}`;
  return WHATSAPP_TICKET_URL;
}
