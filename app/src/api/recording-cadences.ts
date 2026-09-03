/**
 * Recording cadence (RC3) operations against the backend. Mirrors
 * `api/recordings.ts`'s shape — one function per endpoint, no client-side
 * caching or state; that lives in `hooks/useRecordingCadences.ts`.
 */
import { type RecordingCadence, type RecordingCadenceUpdate, requireApi } from './client';

/** Every cadence this user has set, across all subjects — small enough
 *  (one row per subject a cadence was ever set on) that the frontend fetches
 *  it whole and looks up its subject client-side, mirroring how
 *  `useRecordings` reads its list. */
export async function listRecordingCadences(): Promise<RecordingCadence[]> {
  const { data, error } = await requireApi().GET('/v1/recording-cadences');
  if (error || !data) throw new Error('Failed to load recording cadences');
  return data;
}

/**
 * Upsert the cadence for one subject — `intervalDays: null` turns it off
 * (see `RecordingCadence`'s docstring in `backend/app/models/recording.py`
 * for why NULL, not `0` or a delete, is "off"). A second call for the same
 * subject updates the same row in place.
 */
export async function putRecordingCadence(
  subjectKind: string,
  subjectId: string,
  intervalDays: number | null,
): Promise<RecordingCadence> {
  const body: RecordingCadenceUpdate = { intervalDays };
  const { data, error } = await requireApi().PUT(
    '/v1/recording-cadences/{subject_kind}/{subject_id}',
    {
      params: { path: { subject_kind: subjectKind, subject_id: subjectId } },
      body,
    },
  );
  if (error || !data) throw new Error('Failed to save recording cadence');
  return data;
}
