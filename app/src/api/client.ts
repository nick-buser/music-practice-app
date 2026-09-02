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
