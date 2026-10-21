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
 * The digits are monospace and each flap has a fixed width, so nothing
 * reflows as values change — a count that nudges the layout every minute is
 * worse than no animation.
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
      style={{ fontFamily: 'var(--font-mono), monospace' }}
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
      style={{
        // Digits are fixed-width so the row cannot reflow; a colon is narrow.
        width: isDigit ? '0.62em' : '0.3em',
        textAlign: 'center',
        animation: flipping && isDigit ? 'flap 240ms ease-in-out' : undefined,
        transformOrigin: 'center bottom',
        backfaceVisibility: 'hidden',
      }}
    >
      {display}
    </span>
  );
}
