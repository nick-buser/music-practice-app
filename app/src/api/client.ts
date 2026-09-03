/**
 * The typed API client — built from the generated OpenAPI contract.
 *
 * `openapi-fetch` types every request/response against `paths` from
 * `schema.d.ts` (generated from backend/openapi.json), so the call sites can't
 * drift from the backend. The client is `null` on the public/static build
 * (`backendEnabled` false), so backend features simply don't activate there.
 */
import createClient, { type Client } from 'openapi-fetch';

import { API_BASE_URL } from '../config';
import type { components, paths } from './schema';

export type ApiClient = Client<paths>;

/** Typed client, or null when no backend is configured (public build). */
export const api: ApiClient | null = API_BASE_URL
  ? createClient<paths>({ baseUrl: API_BASE_URL })
  : null;

/** Throw if a backend call is attempted on the backend-less build. */
export function requireApi(): ApiClient {
  if (!api) throw new Error('Backend is disabled (VITE_API_BASE_URL is unset).');
  return api;
}

// DTO aliases sourced straight from the contract — one source of truth.
export type ChordIdentityDto = components['schemas']['ChordIdentity'];
export type SavedChord = components['schemas']['SavedChordRead'];
export type SavedChordCreate = components['schemas']['SavedChordCreate'];
export type PracticeSessionDto = components['schemas']['PracticeSessionRead'];
export type PracticeSessionCreate = components['schemas']['PracticeSessionCreate'];

// Ideas (Sketchbook) — see docs/sketchbook.md for the object model.
export type Idea = components['schemas']['IdeaRead'];
export type IdeaSummary = components['schemas']['IdeaSummary'];
export type IdeaCreate = components['schemas']['IdeaCreate'];
export type IdeaUpdate = components['schemas']['IdeaUpdate'];
export type IdeaStatus = components['schemas']['IdeaRead']['status'];
export type IdeaAsset = components['schemas']['IdeaAssetRead'];
export type IdeaAssetRevisionGroup = components['schemas']['IdeaAssetRevisionGroup'];
export type IdeaAssetRole = components['schemas']['IdeaAssetRead']['role'];
export type IdeaLinkEdge = components['schemas']['IdeaLinkEdge'];
export type IdeaLinkCreate = components['schemas']['IdeaLinkCreate'];

// Provenance (PV1/PV3) — a property plus the run that produced it, the
// lineage `PropertiesPanel` renders (docs/recordings-provenance.md).
export type IdeaProperty = components['schemas']['ExtractedPropertyWithRun'];

// Recordings (RC2 capture) — a practice take (mic audio, later MIDI-in-
// parallel) attached to a subject (piece/scale) or a session.
export type Recording = components['schemas']['RecordingRead'];
export type RecordingSummary = components['schemas']['RecordingSummary'];
export type RecordingCreate = components['schemas']['RecordingCreate'];
export type RecordingTrack = components['schemas']['RecordingTrackRead'];
export type RecordingTrackKind = components['schemas']['RecordingTrackRead']['kind'];

// Recording cadences (RC3) — "record this weekly": how often a subject
// wants a fresh take, plus the due chip computed from it and the subject's
// latest recording (`data/cadence.ts`'s `dueState`).
export type RecordingCadence = components['schemas']['RecordingCadenceRead'];
export type RecordingCadenceUpdate = components['schemas']['RecordingCadenceUpdate'];
