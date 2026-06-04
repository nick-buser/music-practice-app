import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COMPOSITION_BY_ID } from '../../data/raga/composition';
import { TALA_BY_ID } from '../../data/raga/tala';
import { CompositionPlayer } from './CompositionPlayer';

// jsdom has no Web Audio; a minimal fake lets the scheduler run without sound.
class FakeNode {
  connect(node: unknown) {
    return node;
  }
}
class FakeOsc extends FakeNode {
  type = '';
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

const section = COMPOSITION_BY_ID.get('yaman-sargam')!.sections[0];
const tala = TALA_BY_ID.get('teental')!;

describe('CompositionPlayer', () => {
  beforeEach(() => vi.stubGlobal('AudioContext', FakeAudioContext));
  afterEach(() => vi.unstubAllGlobals());

  it('toggles the transport between play and stop', () => {
    render(<CompositionPlayer section={section} tala={tala} bpm={120} />);
    const play = screen.getByRole('button', { name: /Play Sthāyī/ });
    expect(play.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(play);
    expect(screen.getByRole('button', { name: /Stop Sthāyī/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('loops by default and can be toggled off', () => {
    render(<CompositionPlayer section={section} tala={tala} bpm={120} />);
    const loop = screen.getByRole('button', { name: 'Loop' });
    expect(loop.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(loop);
    expect(loop.getAttribute('aria-pressed')).toBe('false');
  });
});
