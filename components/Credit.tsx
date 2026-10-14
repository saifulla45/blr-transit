/** Build credit, shown in the footer of every page. */
const AUTHOR = 'Saifulla Attar';
const AUTHOR_URL = 'https://www.linkedin.com/in/mdsaifullaattar';

export function Credit() {
  return (
    <span>
      Built by{' '}
      <a
        className="underline"
        href={AUTHOR_URL}
        target="_blank"
        // noreferrer alongside noopener: this is an outbound profile link.
        rel="noreferrer"
      >
        {AUTHOR}
      </a>
      .
    </span>
  );
}
