/**
 * Recording (RC2 capture) operations against the backend. Mirrors
 * `api/ideas.ts`'s shape — one function per endpoint, no client-side
 * caching or state; that lives in `hooks/useRecordings.ts`.
 */
import { API_BASE_URL } from '../config';
import {
  type Recording,
  type RecordingCreate,
  type RecordingSummary,
  type RecordingTrack,
  type RecordingTrackKind,
  requireApi,
} from './client';

export interface ListRecordingsParams {
  subjectKind?: string;
  subjectId?: string;
  limit?: number;
  offset?: number;
}

export async function listRecordings(params: ListRecordingsParams = {}): Promise<RecordingSummary[]> {
  const { data, error } = await requireApi().GET('/v1/recordings', {
    // 200 mirrors listIdeas's page size — plenty for a subject's take
    // history; paging is a later ticket's job.
    params: { query: { limit: 200, ...params } },
  });
  if (error || !data) throw new Error('Failed to load recordings');
  return data.items;
}

export async function createRecording(input: RecordingCreate): Promise<Recording> {
  const { data, error } = await requireApi().POST('/v1/recordings', { body: input });
  if (error || !data) throw new Error('Failed to create recording');
  return data;
}

/** The single-recording shape, tracks included (`RecordingSummary` — the
 *  list shape — deliberately omits them; see its doc comment in schema.d.ts). */
export async function getRecording(id: string): Promise<Recording> {
  const { data, error } = await requireApi().GET('/v1/recordings/{recording_id}', {
    params: { path: { recording_id: id } },
  });
  if (error || !data) throw new Error('Failed to load recording');
  return data;
}

export async function deleteRecording(id: string): Promise<void> {
  const { error } = await requireApi().DELETE('/v1/recordings/{recording_id}', {
    params: { path: { recording_id: id } },
  });
  if (error) throw new Error('Failed to delete recording');
}

/**
 * Upload one track (an audio take today; MIDI-in-parallel is deferred to a
 * follow-up after SB7) onto a recording created via `createRecording`.
 */
export async function uploadRecordingTrack(
  recordingId: string,
  file: Blob,
  kind: RecordingTrackKind,
  offsetMs?: number,
): Promise<RecordingTrack> {
  const form = new FormData();
  form.append('file', file, file instanceof File ? file.name : 'take.webm');
  form.append('kind', kind);
  if (offsetMs !== undefined) form.append('offsetMs', String(offsetMs));
  const { data, error } = await requireApi().POST('/v1/recordings/{recording_id}/tracks', {
    params: { path: { recording_id: recordingId } },
    // Same bridge as uploadIdeaAsset in api/ideas.ts: the generated multipart
    // body types `file` as `string` (openapi-typescript has no first-class
    // File/Blob for FastAPI's binary contentMediaType) — at runtime this is
    // a real multipart/form-data upload; openapi-fetch's defaultBodySerializer
    // passes a `FormData` body straight through untouched.
    body: form as unknown as { file: string; kind: RecordingTrackKind; offsetMs?: number },
  });
  if (error || !data) throw new Error('Failed to upload recording track');
  return data;
}

/**
 * The URL an `<audio>` element can point at directly for a track's raw bytes
 * — the takes list's `src`, same idiom as `ideaAssetContentUrl`.
 */
export function recordingTrackContentUrl(recordingId: string, trackId: string): string {
  return `${API_BASE_URL ?? ''}/v1/recordings/${recordingId}/tracks/${trackId}/content`;
}
