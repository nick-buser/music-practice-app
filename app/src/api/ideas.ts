/**
 * Idea (Sketchbook) operations against the backend. Every payload/response is
 * the contract type from `client.ts` (generated from openapi.json). Mirrors
 * `chords.ts`'s shape — one function per endpoint, no client-side caching or
 * state; that lives in `hooks/useIdeas.ts`.
 */
import {
  type Idea,
  type IdeaAsset,
  type IdeaAssetRevisionGroup,
  type IdeaAssetRole,
  type IdeaCreate,
  type IdeaLinkCreate,
  type IdeaLinkEdge,
  type IdeaStatus,
  type IdeaSummary,
  type IdeaUpdate,
  requireApi,
} from './client';

export interface ListIdeasParams {
  status?: IdeaStatus;
  kind?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export async function listIdeas(params: ListIdeasParams = {}): Promise<IdeaSummary[]> {
  const { data, error } = await requireApi().GET('/v1/ideas', {
    // 200 mirrors chords.ts's listSavedChords — plenty for a personal
    // notebook's early life; paging is a later ticket's job.
    params: { query: { limit: 200, ...params } },
  });
  if (error || !data) throw new Error('Failed to load ideas');
  return data.items;
}

export async function createIdea(input: IdeaCreate): Promise<Idea> {
  const { data, error } = await requireApi().POST('/v1/ideas', { body: input });
  if (error || !data) throw new Error('Failed to create idea');
  return data;
}

export async function getIdea(id: string): Promise<Idea> {
  const { data, error } = await requireApi().GET('/v1/ideas/{idea_id}', {
    params: { path: { idea_id: id } },
  });
  if (error || !data) throw new Error('Failed to load idea');
  return data;
}

export async function updateIdea(id: string, patch: IdeaUpdate): Promise<Idea> {
  const { data, error } = await requireApi().PATCH('/v1/ideas/{idea_id}', {
    params: { path: { idea_id: id } },
    body: patch,
  });
  if (error || !data) throw new Error('Failed to update idea');
  return data;
}

export async function deleteIdea(id: string): Promise<void> {
  const { error } = await requireApi().DELETE('/v1/ideas/{idea_id}', {
    params: { path: { idea_id: id } },
  });
  if (error) throw new Error('Failed to delete idea');
}

export async function listIdeaAssets(ideaId: string): Promise<IdeaAssetRevisionGroup[]> {
  const { data, error } = await requireApi().GET('/v1/ideas/{idea_id}/assets', {
    params: { path: { idea_id: ideaId } },
  });
  if (error || !data) throw new Error('Failed to load idea assets');
  return data;
}

/**
 * The capture-path role guess (docs/sketchbook.md): `audio/midi` is the raw
 * performance itself, so it gets `melody`; other audio brought in as a file
 * is a `reference`; images are `image`; anything else falls back to `other`.
 */
export function guessAssetRole(file: File): IdeaAssetRole {
  const mime = file.type;
  if (mime === 'audio/midi' || mime === 'audio/x-midi') return 'melody';
  if (mime.startsWith('audio/')) return 'reference';
  if (mime.startsWith('image/')) return 'image';
  return 'other';
}

export async function uploadIdeaAsset(
  ideaId: string,
  file: File,
  role: IdeaAssetRole,
  newRevision = false,
): Promise<IdeaAsset> {
  const form = new FormData();
  form.append('file', file);
  form.append('role', role);
  if (newRevision) form.append('newRevision', 'true');
  const { data, error } = await requireApi().POST('/v1/ideas/{idea_id}/assets', {
    params: { path: { idea_id: ideaId } },
    // The generated multipart body types `file` as `string` (openapi-typescript
    // has no first-class File/Blob for FastAPI's binary contentMediaType) —
    // at runtime this is a real multipart/form-data upload; openapi-fetch's
    // defaultBodySerializer passes a `FormData` body straight through
    // untouched (`body instanceof FormData`), so this cast bridges the
    // generated type, not the actual request.
    body: form as unknown as { file: string; role: IdeaAssetRole; newRevision?: boolean },
  });
  if (error || !data) throw new Error('Failed to upload idea asset');
  return data;
}

export async function deleteIdeaAsset(ideaId: string, assetId: string): Promise<void> {
  const { error } = await requireApi().DELETE('/v1/ideas/{idea_id}/assets/{asset_id}', {
    params: { path: { idea_id: ideaId, asset_id: assetId } },
  });
  if (error) throw new Error('Failed to delete idea asset');
}

/**
 * Download the raw bytes of an idea asset. The route streams binary data; FX1 ensures
 * the contract documents this as application/octet-stream, not JSON.
 */
export async function downloadIdeaAsset(ideaId: string, assetId: string): Promise<Blob> {
  const { data, error } = await requireApi().GET(
    '/v1/ideas/{idea_id}/assets/{asset_id}/content',
    { params: { path: { idea_id: ideaId, asset_id: assetId } }, parseAs: 'blob' },
  );
  if (error || !data) throw new Error('Failed to download idea asset');
  return data;
}

export async function createIdeaLink(ideaId: string, input: IdeaLinkCreate): Promise<IdeaLinkEdge> {
  const { data, error } = await requireApi().POST('/v1/ideas/{idea_id}/links', {
    params: { path: { idea_id: ideaId } },
    body: input,
  });
  if (error || !data) throw new Error('Failed to create idea link');
  return data;
}

export async function deleteIdeaLink(ideaId: string, linkId: string): Promise<void> {
  const { error } = await requireApi().DELETE('/v1/ideas/{idea_id}/links/{link_id}', {
    params: { path: { idea_id: ideaId, link_id: linkId } },
  });
  if (error) throw new Error('Failed to delete idea link');
}
