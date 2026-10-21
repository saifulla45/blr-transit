/**
 * Build credit, shown at the foot of every page.
 *
 * Sized and coloured here rather than left to each caller. It was inheriting
 * the footer's 12px muted grey and sitting below three paragraphs of licence
 * text, which made the one line naming the person who built the thing the
 * least visible thing on the page. It now reads at body size in full-strength
 * ink with an accent link, and callers place it above the fine print.
 */
const AUTHOR = 'Saifulla Attar';
const AUTHOR_URL = 'https://www.linkedin.com/in/mdsaifullaattar';

export function Credit() {
  return (
    <span className="text-[0.9375rem]" style={{ color: 'var(--ink)' }}>
      Built by{' '}
      <a
        className="font-semibold underline underline-offset-2"
        style={{ color: 'var(--accent)', textDecorationThickness: '2px' }}
        href={AUTHOR_URL}
        target="_blank"
        // noreferrer alongside noopener: this is an outbound profile link.
        rel="noreferrer"
      >
        {AUTHOR}
      </a>
    </span>
  );
}
