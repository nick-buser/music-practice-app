/**
 * Saved-chord operations against the backend. Every payload/response is the
 * contract type from `client.ts` (generated from openapi.json).
 */
import type { ChordIdentity } from '../data/chord-identity';
import { type ChordIdentityDto, requireApi, type SavedChord } from './client';

export async function listSavedChords(): Promise<SavedChord[]> {
  const { data, error } = await requireApi().GET('/v1/chords', {
    params: { query: { limit: 200 } },
  });
  if (error || !data) throw new Error('Failed to load saved chords');
  return data.items;
}

export async function saveChord(identity: ChordIdentity, label: string): Promise<SavedChord> {
  const { data, error } = await requireApi().POST('/v1/chords', {
    // The frontend ChordIdentity is contract-compatible (see contract.test.ts).
    body: { identity: identity as ChordIdentityDto, label },
  });
  if (error || !data) throw new Error('Failed to save chord');
  return data;
}

export async function deleteSavedChord(id: string): Promise<void> {
  const { error } = await requireApi().DELETE('/v1/chords/{chord_id}', {
    params: { path: { chord_id: id } },
  });
  if (error) throw new Error('Failed to delete saved chord');
}
