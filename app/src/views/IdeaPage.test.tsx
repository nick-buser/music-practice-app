import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Idea, IdeaAsset, IdeaAssetRevisionGroup, IdeaUpdate } from '../api/client';

// Simulate the LOCAL build: a backend is configured — same convention as
// SketchbookLive.test.tsx.
vi.mock('../config', () => ({ backendEnabled: true, API_BASE_URL: 'http://test' }));

// Mock the ideas API so the page exercises the hook/UI without a server.
// `guessAssetRole` and `ideaAssetContentUrl` are left as the real
// implementation (via importOriginal) — the content-URL builder under test
// (AC2) is the actual production logic, not a re-description of it.
const getIdea = vi.fn();
const listIdeaAssets = vi.fn();
const listIdeaProperties = vi.fn();
const updateIdea = vi.fn();
const uploadIdeaAsset = vi.fn();
vi.mock('../api/ideas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/ideas')>();
  return {
    ...actual,
    getIdea: (id: string) => getIdea(id),
    listIdeaAssets: (id: string) => listIdeaAssets(id),
    listIdeaProperties: (id: string) => listIdeaProperties(id),
    updateIdea: (id: string, patch: IdeaUpdate) => updateIdea(id, patch),
    uploadIdeaAsset: (ideaId: string, file: File, role: string, newRevision?: boolean) =>
      uploadIdeaAsset(ideaId, file, role, newRevision),
  };
});

import { IdeaPage } from './IdeaPage';

function makeIdea(overrides: Partial<Idea> & Pick<Idea, 'id' | 'handle'>): Idea {
  return {
    body: '',
    bpm: null,
    capturedAt: '2026-09-01T10:00:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    key: null,
    kinds: [],
    linksIn: [],
    linksOut: [],
    meter: null,
    status: 'inbox',
    tags: [],
    title: null,
    updatedAt: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

function makeAsset(overrides: Partial<IdeaAsset> & Pick<IdeaAsset, 'id' | 'ideaId' | 'filename' | 'mime' | 'revision'>): IdeaAsset {
  return {
    bytes: 1024,
    createdAt: '2026-09-01T10:00:00Z',
    role: 'other',
    runId: null,
    sha256: 'deadbeef',
    storageKey: `assets/${overrides.id}`,
    updatedAt: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

describe('IdeaPage with a backend (local build)', () => {
  beforeEach(() => {
    getIdea.mockReset();
    listIdeaAssets.mockReset().mockResolvedValue([]);
    listIdeaProperties.mockReset().mockResolvedValue([]);
    updateIdea.mockReset();
    uploadIdeaAsset.mockReset();
  });

  it('renders a [[#n]] body link that navigates by handle, and saves an edited body on blur', async () => {
    const idea = makeIdea({ id: 'idea-1', handle: 5, body: 'See [[#2]] for the reprise.' });
    getIdea.mockResolvedValue(idea);
    updateIdea.mockImplementation((_id: string, patch: IdeaUpdate) =>
      Promise.resolve({ ...idea, ...patch }),
    );
    const onNavigateToHandle = vi.fn();

    render(<IdeaPage ideaId="idea-1" onBack={vi.fn()} onNavigateToHandle={onNavigateToHandle} />);

    const link = await screen.findByRole('link', { name: '#2' });
    fireEvent.click(link);
    expect(onNavigateToHandle).toHaveBeenCalledWith(2);

    // Clicking the body (not the link) flips it into an editable textarea.
    fireEvent.click(screen.getByTestId('idea-body'));
    const textarea = screen.getByLabelText(/idea body/i);
    fireEvent.change(textarea, { target: { value: 'a rewritten body, no link here' } });
    fireEvent.blur(textarea);

    await waitFor(() =>
      expect(updateIdea).toHaveBeenCalledWith('idea-1', { body: 'a rewritten body, no link here' }),
    );
  });

  it('groups attachments by revision and renders an <audio> element with the content URL for audio/webm', async () => {
    const idea = makeIdea({ id: 'idea-1', handle: 1 });
    getIdea.mockResolvedValue(idea);
    const groups: IdeaAssetRevisionGroup[] = [
      {
        revision: 2,
        assets: [
          makeAsset({
            id: 'asset-2', ideaId: 'idea-1', filename: 'take2.webm',
            mime: 'audio/webm', revision: 2, role: 'reference', bytes: 2048,
          }),
        ],
      },
      {
        revision: 1,
        assets: [
          makeAsset({
            id: 'asset-1', ideaId: 'idea-1', filename: 'sketch.mid',
            mime: 'audio/midi', revision: 1, role: 'melody', bytes: 512,
          }),
        ],
      },
    ];
    listIdeaAssets.mockResolvedValue(groups);

    render(<IdeaPage ideaId="idea-1" onBack={vi.fn()} onNavigateToHandle={vi.fn()} />);

    expect(await screen.findByText('revision 2')).toBeInTheDocument();
    expect(screen.getByText('revision 1')).toBeInTheDocument();
    expect(screen.getByText('take2.webm')).toBeInTheDocument();
    expect(screen.getByText('sketch.mid')).toBeInTheDocument();

    const audio = document.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute('src', 'http://test/v1/ideas/idea-1/assets/asset-2/content');
  });

  it('changing status and adding a tag chip both call patch, the tag merged onto the existing list', async () => {
    const idea = makeIdea({ id: 'idea-1', handle: 1, status: 'inbox', tags: ['sketch'] });
    getIdea.mockResolvedValue(idea);
    updateIdea.mockImplementation((_id: string, patch: IdeaUpdate) =>
      Promise.resolve({ ...idea, ...patch }),
    );

    render(<IdeaPage ideaId="idea-1" onBack={vi.fn()} onNavigateToHandle={vi.fn()} />);

    const statusSelect = await screen.findByLabelText(/^status$/i);
    fireEvent.change(statusSelect, { target: { value: 'active' } });
    await waitFor(() => expect(updateIdea).toHaveBeenCalledWith('idea-1', { status: 'active' }));

    const tagInput = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(tagInput, { target: { value: 'chorus' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });

    await waitFor(() =>
      expect(updateIdea).toHaveBeenCalledWith('idea-1', { tags: ['sketch', 'chorus'] }),
    );
  });
});
