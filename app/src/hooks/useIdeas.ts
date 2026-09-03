import { useCallback, useEffect, useRef, useState } from 'react';

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
 * @param q SB5's search-box query (`backend/app/search.py::parse_query`'s
 *   grammar — `tag:x kind:y key:z status:s` plus free text). Filtering
 *   itself is entirely server-side (`GET /v1/ideas?q=`); `SketchbookLive`
 *   already debounces keystrokes by 250ms before this ever changes, so
 *   this hook doesn't debounce again — its only extra job versus the
 *   pre-SB5 version is refetching when `q` changes and not letting a
 *   slow, now-superseded response clobber a faster later one.
 */
export function useIdeas(active: boolean, q?: string): IdeasState {
  const [ideas, setIdeas] = useState<IdeaSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every `refresh()` call; a response is only applied if it's
  // still the most recent request in flight when it lands. Two debounced
  // searches fired close together (or a capture's refresh racing a
  // search's) can have their responses arrive out of order over the
  // network — without this guard, a slow response for an earlier query
  // could overwrite a faster one for the current query.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!backendEnabled) return;
    const requestId = ++requestIdRef.current;
    try {
      const loaded = await listIdeas({ q: q || undefined });
      if (requestIdRef.current !== requestId) return; // superseded — drop it
      // With no search text, the backend orders by captured_at desc, but
      // the stream's whole point is "newest thought first" — sort
      // defensively rather than trust an implementation detail on the
      // other side of the wire, same as pre-SB5. With search text, though,
      // trust the backend's order as-is: on Postgres that's a relevance
      // ranking (`ts_rank`, `app/repositories/ideas.py::list_ideas`) that
      // a client-side recency resort would silently throw away, defeating
      // half the point of full-text search; on SQLite it's already
      // captured_at desc, so this is a no-op there.
      if (!q) loaded.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
      setIdeas(loaded);
      setError(null);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setError('Could not load ideas.');
    }
  }, [q]);

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
