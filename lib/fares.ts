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
