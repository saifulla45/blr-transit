'use client';

import { useSaved } from '@/lib/useSaved';

/** Pin or unpin a station, so a daily commuter stops re-searching it. */
export function SaveButton({ stationId, name }: { stationId: string; name: string }) {
  const { isSaved, toggle } = useSaved();
  const on = isSaved(stationId);

  return (
    <button
      type="button"
      onClick={() => toggle(stationId)}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from saved` : `Save ${name}`}
      className="tap flex items-center gap-1.5 px-2.5 text-[0.75rem] font-semibold transition-colors"
      style={{
        borderRadius: 'var(--r-md)',
        background: on ? 'var(--accent)' : 'var(--surface)',
        color: on ? 'var(--on-accent)' : 'var(--muted)',
        border: '1px solid var(--rule)',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4-7 4v-16a1 1 0 0 1 1-1z" />
      </svg>
      {on ? 'Saved' : 'Save'}
    </button>
  );
}
