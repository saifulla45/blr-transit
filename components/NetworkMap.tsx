'use client';

import dynamic from 'next/dynamic';
import type { NetworkMapProps } from './NetworkMapCanvas';

// MapLibre is the heaviest asset on any page it appears on, and is useless
// server-side.
const Canvas = dynamic(() => import('./NetworkMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>
      Loading map…
    </div>
  ),
});

export function NetworkMap({ className, ...props }: NetworkMapProps & { className?: string }) {
  return (
    <div
      className={className ?? 'h-72 overflow-hidden'}
      style={{
        borderRadius: 'calc(var(--r-md) * 2)',
        border: '1px solid var(--rule)',
        background: 'var(--surface)',
      }}
    >
      <Canvas {...props} />
    </div>
  );
}
