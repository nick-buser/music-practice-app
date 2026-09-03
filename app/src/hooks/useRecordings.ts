import { useCallback, useEffect, useState } from 'react';

import { getRecording, listRecordings } from '../api/recordings';
import type { Recording } from '../api/client';
import { backendEnabled } from '../config';

export interface RecordingsState {
  /** Newest-captured-first, full detail (tracks included) — see `refresh`. */
  recordings: Recording[];
  error: string | null;
  /** Re-fetch the takes for this subject — SessionView calls this after a
   *  create-then-upload cycle lands a new take. */
  refresh: () => Promise<void>;
}

/**
 * The takes list for one subject, backed by the API — mirrors `useIdeas`:
 * gated on `backendEnabled`, fetches only while `active`, never throws (a
 * failure lands in `error`).
 *
 * `GET /v1/recordings` returns `RecordingSummary` — deliberately no
 * `tracks`, so that list stays one query (see its doc comment in
 * `schema.d.ts`). `<audio src>` needs a track id, so this hook follows up
 * with one `getRecording` per summary; a subject's take list is small
 * enough that this per-subject fan-out is a fine trade, unlike a global
 * feed.
 */
export function useRecordings(subjectId: string, active: boolean): RecordingsState {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendEnabled) return;
    try {
      const summaries = await listRecordings({ subjectId });
      const full = await Promise.all(summaries.map((s) => getRecording(s.id)));
      full.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
      setRecordings(full);
      setError(null);
    } catch {
      setError('Could not load takes.');
    }
  }, [subjectId]);

  useEffect(() => {
    if (backendEnabled && active) void refresh();
  }, [active, refresh]);

  return { recordings, error, refresh };
}
