import { useCallback, useEffect, useState } from 'react';

import { deleteSavedChord, listSavedChords, saveChord } from '../api/chords';
import type { SavedChord } from '../api/client';
import { backendEnabled } from '../config';
import type { ChordIdentity } from '../data/chord-identity';

export interface SavedChordsState {
  /** False on the public/static build — the UI hides the feature entirely. */
  enabled: boolean;
  chords: SavedChord[];
  error: string | null;
  save: (identity: ChordIdentity, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Saved chords, backed by the API — but only when a backend is configured.
 * On the public build `enabled` is false and the hook never calls out, so the
 * feature simply doesn't exist there.
 *
 * @param active fetch only while the relevant view (the Chords tab) is open.
 */
export function useSavedChords(active: boolean): SavedChordsState {
  const [chords, setChords] = useState<SavedChord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendEnabled) return;
    try {
      setChords(await listSavedChords());
      setError(null);
    } catch {
      setError('Could not load saved chords.');
    }
  }, []);

  useEffect(() => {
    if (backendEnabled && active) void refresh();
  }, [active, refresh]);

  const save = useCallback(
    async (identity: ChordIdentity, label: string) => {
      try {
        await saveChord(identity, label);
        await refresh();
      } catch {
        setError('Could not save chord.');
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteSavedChord(id);
        await refresh();
      } catch {
        setError('Could not remove chord.');
      }
    },
    [refresh],
  );

  return { enabled: backendEnabled, chords, error, save, remove };
}
