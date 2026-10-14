'use client';

import { useId, useMemo, useRef, useState } from 'react';
import type { StationLite } from '@/types/transit';
import { matchByName } from '@/lib/search';
import { LineTag } from './primitives';
import type { Line } from '@/types/transit';

/**
 * Searchable station picker with live suggestions.
 *
 * Replaces a native <select> of 82 options, which on a phone is a long scroll
 * with no way to type. Matching is transliteration-aware, so "yesvan" finds
 * Yeshwantpur.
 */
export function StationPicker({
  stations, lines, value, onSelect, placeholder, label,
}: {
  stations: StationLite[];
  lines?: Line[];
  value: StationLite | null;
  onSelect: (s: StationLite | null) => void;
  placeholder: string;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(
    () => (open && query.trim() ? matchByName(stations, query, 8) : []),
    [stations, query, open],
  );

  const choose = (s: StationLite) => {
    onSelect(s);
    setQuery('');
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="relative">
      <label htmlFor={listId} className="sr-only">{label}</label>
      <input
        id={listId}
        type="text"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? query : (value?.name ?? '')}
        placeholder={value ? value.name : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        // A click on a suggestion fires after blur, so closing is deferred.
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active]); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
        className="tap w-full px-3.5 text-[0.9375rem] outline-none"
        style={{
          borderRadius: 'var(--r-md)',
          background: 'var(--surface)',
          border: '1px solid var(--rule)',
          color: 'var(--ink)',
        }}
      />

      {matches.length > 0 && (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden"
          style={{
            borderRadius: 'var(--r-md)',
            background: 'var(--raised)',
            border: '1px solid var(--rule)',
            boxShadow: '0 16px 40px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4)',
          }}
        >
          {matches.map((s, i) => (
            <li key={s.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
                onClick={() => choose(s)}
                className="tap flex w-full items-center justify-between gap-2 px-3 text-left text-[0.875rem]"
                style={{ background: i === active ? 'var(--surface)' : 'transparent' }}
              >
                <span className="min-w-0 truncate">{s.name}</span>
                {lines && (
                  <span className="flex shrink-0 gap-1">
                    {s.lines.map((l) => <LineTag key={l} line={l} lines={lines} />)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.trim().length >= 2 && matches.length === 0 && (
        <p
          className="absolute left-0 right-0 top-full z-50 mt-1 px-3 py-2 text-[0.8125rem]"
          style={{
            borderRadius: 'var(--r-md)', background: 'var(--raised)',
            border: '1px solid var(--rule)', color: 'var(--muted)',
            boxShadow: '0 16px 40px rgba(0,0,0,.55)',
          }}
        >
          No station matches “{query.trim()}”.
        </p>
      )}
    </div>
  );
}
