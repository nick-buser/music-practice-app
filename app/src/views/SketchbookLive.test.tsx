import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdeaSummary } from '../api/client';

// Simulate the LOCAL build: a backend is configured — same convention as
// DrillsView.backend.test.tsx.
vi.mock('../config', () => ({ backendEnabled: true, API_BASE_URL: 'http://test' }));

// Mock the ideas API so the feature exercises the hook/UI without a server.
// `guessAssetRole` is left as the real implementation (via importOriginal)
// so the mime→role mapping under test is the actual production logic, not a
// re-description of it.
const listIdeas = vi.fn();
const createIdea = vi.fn();
const uploadIdeaAsset = vi.fn();
vi.mock('../api/ideas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/ideas')>();
  return {
    ...actual,
    listIdeas: () => listIdeas(),
    createIdea: (input: unknown) => createIdea(input),
    uploadIdeaAsset: (ideaId: string, file: File, role: string, newRevision?: boolean) =>
      uploadIdeaAsset(ideaId, file, role, newRevision),
  };
});

import { SketchbookLive } from './SketchbookLive';

function makeIdea(overrides: Partial<IdeaSummary> & Pick<IdeaSummary, 'id' | 'handle' | 'capturedAt'>): IdeaSummary {
  return {
    body: '',
    bpm: null,
    createdAt: overrides.capturedAt,
    key: null,
    kinds: [],
    meter: null,
    status: 'inbox',
    tags: [],
    title: null,
    updatedAt: overrides.capturedAt,
    ...overrides,
  };
}

describe('SketchbookLive with a backend (local build)', () => {
  beforeEach(() => {
    listIdeas.mockReset().mockResolvedValue([]);
    createIdea.mockReset().mockResolvedValue({
      id: 'new-idea',
      handle: 99,
      capturedAt: '2026-09-02T12:00:00Z',
    });
    uploadIdeaAsset.mockReset().mockResolvedValue({ id: 'asset-1' });
  });

  it('renders the stream newest-first regardless of API order', async () => {
    const older = makeIdea({ id: 'a', handle: 1, capturedAt: '2026-08-01T10:00:00Z', body: 'older thought' });
    const newer = makeIdea({ id: 'b', handle: 2, capturedAt: '2026-09-01T10:00:00Z', body: 'newer thought' });
    listIdeas.mockResolvedValue([older, newer]); // deliberately oldest-first

    render(<SketchbookLive />);
    const cards = await screen.findAllByTestId('idea-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('newer thought');
    expect(cards[1]).toHaveTextContent('older thought');
  });

  it('the inbox toggle hides non-inbox ideas until switched off', async () => {
    const inboxIdea = makeIdea({
      id: 'a', handle: 1, capturedAt: '2026-09-01T10:00:00Z', status: 'inbox', body: 'inbox thought',
    });
    const activeIdea = makeIdea({
      id: 'b', handle: 2, capturedAt: '2026-09-01T09:00:00Z', status: 'active', body: 'active thought',
    });
    listIdeas.mockResolvedValue([inboxIdea, activeIdea]);

    render(<SketchbookLive />);
    expect(await screen.findByText('inbox thought')).toBeInTheDocument();
    expect(screen.queryByText('active thought')).not.toBeInTheDocument(); // inbox-only by default

    fireEvent.click(screen.getByRole('button', { name: /inbox only/i }));
    expect(await screen.findByText('active thought')).toBeInTheDocument();
  });

  it('submitting the capture box calls create with the typed body, then clears', async () => {
    render(<SketchbookLive />);
    const textarea = screen.getByPlaceholderText(/catch the thought/i);
    fireEvent.change(textarea, { target: { value: 'a chorus idea' } });
    fireEvent.click(screen.getByRole('button', { name: /capture/i }));

    await waitFor(() => expect(createIdea).toHaveBeenCalledTimes(1));
    expect(createIdea).toHaveBeenCalledWith({ body: 'a chorus idea' });
    expect(uploadIdeaAsset).not.toHaveBeenCalled(); // no file chosen
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('capture with a .mid file uploads the asset with role: melody', async () => {
    render(<SketchbookLive />);
    const textarea = screen.getByPlaceholderText(/catch the thought/i);
    fireEvent.change(textarea, { target: { value: 'melody sketch' } });

    const midiFile = new File(['midi-bytes'], 'melody.mid', { type: 'audio/midi' });
    const fileInput = screen.getByLabelText(/attach a file/i);
    fireEvent.change(fileInput, { target: { files: [midiFile] } });

    fireEvent.click(screen.getByRole('button', { name: /capture/i }));

    await waitFor(() => expect(uploadIdeaAsset).toHaveBeenCalledTimes(1));
    expect(uploadIdeaAsset).toHaveBeenCalledWith('new-idea', midiFile, 'melody', undefined);
  });

  it('does not fetch ideas until the view is mounted, and fetches exactly once on mount', () => {
    render(<SketchbookLive />);
    expect(listIdeas).toHaveBeenCalledTimes(1); // mounted → active → one initial fetch
  });
});
