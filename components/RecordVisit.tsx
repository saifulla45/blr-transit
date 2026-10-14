'use client';

import { useEffect } from 'react';
import { recordVisit } from '@/lib/useRecents';

/** Records that this station was viewed, for the recents list on the home page. */
export function RecordVisit({ stationId }: { stationId: string }) {
  useEffect(() => { recordVisit(stationId); }, [stationId]);
  return null;
}
