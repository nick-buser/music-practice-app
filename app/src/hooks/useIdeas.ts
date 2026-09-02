import { useCallback, useEffect, useState } from 'react';

import { createIdea, guessAssetRole, listIdeas, uploadIdeaAsset } from '../api/ideas';
import type { IdeaSummary } from '../api/client';
import { backendEnabled } from '../config';

export interface IdeasState {
  /** False on the public/static build — the UI hides the feature entirely. */
  enabled: boolean;
  /** Reverse-chronological (newest capture first) — see `refresh` below. */
  ideas: IdeaSummary[];
  error: string | null;
  /**
   * Quick-capture: posts an inbox idea with `body`, then — if `file` is
   * given — uploads it as an asset with its role guessed from mime
   * (docs/sketchbook.md). Never throws; a failure lands in `error`, same
   * as `useSavedChords.save`/`remove`, so the caller can always safely
   * clear its input after awaiting this.
   */
  capture: (body: string, file: File | null) => Promise<void>;
}

/**
 * The idea stream, backed by the API — but only when a backend is
 * configured. On the public build `enabled` is false and the hook never
 * calls out, so the feature simply doesn't exist there.
 *
 * @param active fetch only while the relevant view (the Sketchbook tab) is open.
 */
export function useIdeas(active: boolean): IdeasState {
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendEnabled) return;
    try {
      const loaded = await listIdeas();
      // The backend already orders by captured_at desc, but the stream's
      // whole point is "newest thought first" — sort defensively rather
      // than trust an implementation detail on the other side of the wire.
      loaded.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
      setIdeas(loaded);
      setError(null);
    } catch {
      setError('Could not load ideas.');
    }
  }, []);

  useEffect(() => {
    if (backendEnabled && active) void refresh();
  }, [active, refresh]);

  const capture = useCallback(
    async (body: string, file: File | null) => {
      try {
        const idea = await createIdea({ body });
        if (file) {
          await uploadIdeaAsset(idea.id, file, guessAssetRole(file));
        }
        await refresh();
      } catch {
        setError('Could not capture idea.');
      }
    },
    [refresh],
  );

  return { enabled: backendEnabled, ideas, error, capture };
}
