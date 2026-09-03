import { useCallback, useEffect, useState } from 'react';

import { getIdea, listIdeaAssets, updateIdea, uploadIdeaAsset } from '../api/ideas';
import type { Idea, IdeaAssetRevisionGroup, IdeaAssetRole, IdeaUpdate } from '../api/client';
import { backendEnabled } from '../config';

export interface IdeaState {
  idea: Idea | null;
  assets: IdeaAssetRevisionGroup[];
  loading: boolean;
  error: string | null;
  /**
   * Merge `patch` into the idea and persist it — every editable field on the
   * idea page (title, body, status, kinds/tags, key/meter/bpm) goes through
   * this one function, same idiom as `useIdeas.capture`: never throws, a
   * failure lands in `error` so the caller can always await it safely.
   */
  patch: (patch: IdeaUpdate) => Promise<void>;
  /** Upload an attachment, then reload the revision groups. */
  uploadAsset: (file: File, role: IdeaAssetRole, newRevision: boolean) => Promise<void>;
}

/**
 * A single idea, backed by the API — the idea page's counterpart to
 * `useIdeas` (the stream). Fetches the idea and its attachments together on
 * mount / whenever `ideaId` changes, since the page always needs both.
 */
export function useIdea(ideaId: string): IdeaState {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [assets, setAssets] = useState<IdeaAssetRevisionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!backendEnabled) return;
    setLoading(true);
    try {
      const [loadedIdea, loadedAssets] = await Promise.all([
        getIdea(ideaId),
        listIdeaAssets(ideaId),
      ]);
      setIdea(loadedIdea);
      setAssets(loadedAssets);
      setError(null);
    } catch {
      setError('Could not load this idea.');
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = useCallback(
    async (update: IdeaUpdate) => {
      try {
        setIdea(await updateIdea(ideaId, update));
        setError(null);
      } catch {
        setError('Could not save the change.');
      }
    },
    [ideaId],
  );

  const uploadAsset = useCallback(
    async (file: File, role: IdeaAssetRole, newRevision: boolean) => {
      try {
        await uploadIdeaAsset(ideaId, file, role, newRevision);
        setAssets(await listIdeaAssets(ideaId));
        setError(null);
      } catch {
        setError('Could not upload the attachment.');
      }
    },
    [ideaId],
  );

  return { idea, assets, loading, error, patch, uploadAsset };
}
