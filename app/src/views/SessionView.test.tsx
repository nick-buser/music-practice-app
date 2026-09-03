import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Stub Verovio (too slow / unavailable in jsdom) — same idiom as DrillsView.
vi.mock('../verovio/SessionScore', () => ({
  SessionScore: () => <span data-testid="session-score-stub" />,
}));

import { SessionView } from './SessionView';

// jsdom has no Web Audio; a minimal fake lets useMetronome's scheduler run
// silently (SessionView starts with `playing: true`) — same idiom as
// CompositionPlayer.test.tsx.
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

// No `../config` mock here — this exercises the REAL config module, which
// config.test.ts pins to `backendEnabled === false` in the default test
// env (no VITE_API_BASE_URL set): the public/static build.
describe('SessionView on the public build (no backend)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('has no record control and no takes list — the public build never assumes a server', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    render(<SessionView subjectId="chopin-9-2" onEnd={() => {}} onOpenPiece={() => {}} />);

    expect(screen.queryByRole('button', { name: /record a take/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('takes-list')).not.toBeInTheDocument();
  });
});
