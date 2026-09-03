import { useCallback, useEffect, useState } from 'react';

import { listRecordingCadences, putRecordingCadence } from '../api/recording-cadences';
import type { RecordingCadence } from '../api/client';
import { backendEnabled } from '../config';

export interface RecordingCadenceState {
  /** This subject's cadence, or `null` if none has ever been set (distinct
   *  from an explicit "off", which is a row with `intervalDays: null` —
   *  see `RecordingCadence`'s docstring in `backend/app/models/recording.py`). */
  cadence: RecordingCadence | null;
  error: string | null;
  /** Upsert this subject's cadence (`null` turns it off) and refresh. */
  setCadence: (intervalDays: number | null) => Promise<void>;
}

/**
 * The cadence for one subject, backed by the API — mirrors `useRecordings`:
 * gated on `backendEnabled`, fetches only while `active`, never throws (a
 * failure lands in `error`).
 *
 * `GET /v1/recording-cadences` returns every cadence the user has ever set
 * (RC3 doesn't expose a per-subject GET); this hook fetches that small list
 * and picks out the one row for `subjectId`, mirroring the shape
 * `app/data/cadence.ts`'s `dueState` expects.
 */
export function useRecordingCadences(
  subjectKind: string,
  subjectId: string,
  active: boolean,
): RecordingCadenceState {
  const [cadence, setCadenceState] = useState<RecordingCadence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendEnabled) return;
    try {
      const all = await listRecordingCadences();
      setCadenceState(all.find((c) => c.subjectId === subjectId) ?? null);
      setError(null);
    } catch {
      setError('Could not load cadence.');
    }
  }, [subjectId]);

  useEffect(() => {
    if (backendEnabled && active) void refresh();
  }, [active, refresh]);

  const setCadence = useCallback(
    async (intervalDays: number | null) => {
      if (!backendEnabled) return;
      try {
        const updated = await putRecordingCadence(subjectKind, subjectId, intervalDays);
        setCadenceState(updated);
        setError(null);
      } catch {
        setError('Could not save cadence.');
      }
    },
    [subjectKind, subjectId],
  );

  return { cadence, error, setCadence };
}
