import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Idea, IdeaSummary } from './api/client';

// Simulate the LOCAL build: a backend is configured — same convention as
// SketchbookLive.test.tsx / IdeaPage.test.tsx.
vi.mock('./config', () => ({ backendEnabled: true, API_BASE_URL: 'http://test' }));

// Verovio's WASM toolkit takes seconds to spin up and jsdom can't host it
// anyway (LibraryView.test.tsx) — App mounts on the Library view first, so
// its thumbnails need the same stub. SessionScore is never actually
// rendered by an idea subject (abc is undefined — that's the point of this
// test), but stub it too rather than rely on that.
vi.mock('./verovio/Score', () => ({
  Score: () => <span data-testid="score-stub" />,
}));
vi.mock('./verovio/SessionScore', () => ({
  SessionScore: () => <span data-testid="session-score-stub" />,
}));

// Mock the ideas API so the whole flow (stream → idea page → session)
// exercises real hook/UI wiring without a server — same shape as
// SketchbookLive.test.tsx and IdeaPage.test.tsx's `../api/ideas` mocks.
const listIdeas = vi.fn();
const getIdea = vi.fn();
const listIdeaAssets = vi.fn();
const listIdeaProperties = vi.fn();
vi.mock('./api/ideas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/ideas')>();
  return {
    ...actual,
    listIdeas: () => listIdeas(),
    getIdea: (id: string) => getIdea(id),
    listIdeaAssets: (id: string) => listIdeaAssets(id),
    listIdeaProperties: (id: string) => listIdeaProperties(id),
  };
});

import App from './App';

// jsdom has no Web Audio; a minimal fake lets useMetronome's scheduler run
// silently (SessionView starts with `playing: true`) — same idiom as
// SessionView.test.tsx / SessionView.backend.test.tsx.
class FakeNode {
  connect(node: unknown) {
    return node;
  }
}
class FakeOsc extends FakeNode {
  frequency = { value: 0 };
  start() {}
  stop() {}
}
class FakeGain extends FakeNode {
  gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
}
class FakeAudioContext {
  currentTime = 0;
  destination = new FakeNode();
  resume() {
    return Promise.resolve();
  }
  createOscillator() {
    return new FakeOsc();
  }
  createGain() {
    return new FakeGain();
  }
}

const IDEA_ID = 'idea-uuid-1';

function makeIdeaSummary(): IdeaSummary {
  return {
    id: IDEA_ID,
    handle: 7,
    body: 'a chorus fragment',
    bpm: null,
    capturedAt: '2026-09-01T10:00:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    key: null,
    kinds: ['melody'],
    meter: null,
    status: 'inbox',
    tags: [],
    title: 'A sounding sketch',
    updatedAt: '2026-09-01T10:00:00Z',
  };
}

function makeIdeaFull(): Idea {
  return { ...makeIdeaSummary(), linksIn: [], linksOut: [] };
}

describe('App: practicing an idea (SB4)', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    listIdeas.mockReset().mockResolvedValue([makeIdeaSummary()]);
    getIdea.mockReset().mockResolvedValue(makeIdeaFull());
    listIdeaAssets.mockReset().mockResolvedValue([]);
    listIdeaProperties.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starting a session from an idea renders its title with no score, and ending it returns to the sketchbook', async () => {
    render(<App />);

    // Library renders first (App's default view) — navigate to Sketchbook.
    fireEvent.click(screen.getByText(/sketchbook/i));

    // Open the one idea in the stream.
    const card = await screen.findByTestId('idea-card');
    fireEvent.click(card);

    // IdeaPage loaded — "Practice this" starts a session on it.
    const practiceBtn = await screen.findByRole('button', { name: /practice this/i });
    fireEvent.click(practiceBtn);

    // SessionView: the idea's title renders...
    expect(await screen.findByRole('heading', { name: /A sounding sketch/i })).toBeInTheDocument();
    // ...and no score renders — no Verovio engraving, just the "no score
    // data" placeholder SessionView already falls back to when abc is
    // undefined.
    expect(screen.queryByTestId('session-score-stub')).not.toBeInTheDocument();
    expect(screen.getByText('no score data')).toBeInTheDocument();

    // Ending the session returns to the sketchbook, not Library.
    fireEvent.click(screen.getByRole('button', { name: /end session/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/catch the thought/i)).toBeInTheDocument());
  });
});
