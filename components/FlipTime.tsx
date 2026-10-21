'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A split-flap departure time.
 *
 * Chosen because it is the subject's own vocabulary rather than a generic
 * web flourish: this is what the board above the platform does, and the
 * motion means something — a flap turns exactly when that digit changes,
 * so movement on screen is a departure actually moving.
 *
 * Each character is its own flap. Only the ones whose value changed animate,
 * which is why "3:16" ticking to "3:17" turns a single flap instead of the
 * whole display twitching.
 *
 * Set in the UI face with tabular figures, NOT the monospace used for dense
 * columns of times elsewhere. Monospace gives every glyph the same advance,
 * including the colon, so at display size "5:17" reads as "5 : 17" — the
 * same fault the hero stats had. Forcing a narrower box on the colon made
 * it worse rather than better: the glyph still advanced 24.4px inside an
 * 11.8px box, overflowing six pixels each side, which left a gap after the
 * 5 and collided with the 1.
 *
 * Tabular figures solve the real requirement — every DIGIT the same width,
 * so nothing reflows as the time ticks — while leaving punctuation its
 * natural, narrow advance.
 */
export function FlipTime({
  value,
  className = '',
  ariaLabel,
}: {
  /** Already-formatted, e.g. "3:16" or "11:05". */
  value: string;
  className?: string;
  ariaLabel?: string;
}) {
  const chars = value.split('');

  return (
    <span
      className={`inline-flex items-baseline ${className}`}
      // The family is set here, not inherited: an ancestor applies the
      // mono face for dense time columns, which is the wrong choice at
      // display size where its full-cell colon reads as "5 : 17".
      style={{ fontFamily: 'var(--font-ui), system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}
      aria-label={ariaLabel ?? value}
      role="text"
    >
      {chars.map((c, i) => (
        // Index keys are correct here: position in the display is the
        // identity. Keying by character would recycle flaps across columns
        // and animate the wrong ones.
        <Flap key={i} char={c} />
      ))}
    </span>
  );
}

function Flap({ char }: { char: string }) {
  const [display, setDisplay] = useState(char);
  const [flipping, setFlipping] = useState(false);
  const previous = useRef(char);

  useEffect(() => {
    if (char === previous.current) return undefined;
    previous.current = char;

    setFlipping(true);
    // Swap the character at the midpoint, where the flap is edge-on and the
    // change is invisible — the illusion depends on this timing.
    const swap = setTimeout(() => setDisplay(char), 110);
    const done = setTimeout(() => setFlipping(false), 240);
    return () => { clearTimeout(swap); clearTimeout(done); };
  }, [char]);

  // Punctuation does not flip; a colon that somersaults looks like a bug.
  const isDigit = /\d/.test(display);

  return (
    <span
      aria-hidden
      className="inline-block"
      // No width override. Tabular figures already give every digit the
      // same advance, and the colon keeps its own narrow one.
      style={{
        animation: flipping && isDigit ? 'flap 240ms ease-in-out' : undefined,
        transformOrigin: 'center bottom',
        backfaceVisibility: 'hidden',
      }}
    >
      {display}
    </span>
  );
}
