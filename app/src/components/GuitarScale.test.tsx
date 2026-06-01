import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderScaleSpy, setDotsSpy, renderSpy, getScaleSpy } = vi.hoisted(() => ({
  renderScaleSpy: vi.fn(),
  setDotsSpy: vi.fn(),
  renderSpy: vi.fn(),
  getScaleSpy: vi.fn(),
}));

vi.mock('@moonwave99/fretboard.js', () => ({
  Fretboard: class {
    renderScale(arg: unknown) {
      renderScaleSpy(arg);
      return this;
    }
    setDots(dots: unknown) {
      setDotsSpy(dots);
      return this;
    }
    render() {
      renderSpy();
      return this;
    }
  },
  FretboardSystem: class {
    getScale(arg: unknown) {
      return getScaleSpy(arg);
    }
  },
}));

import { GuitarScale } from './GuitarScale';

describe('GuitarScale', () => {
  beforeEach(() => {
    renderScaleSpy.mockReset();
    setDotsSpy.mockReset();
    renderSpy.mockReset();
    getScaleSpy.mockReset().mockReturnValue([]);
  });

  it('renders a scale by Tonal name (ascii root)', async () => {
    render(<GuitarScale family="harmonic-minor" tonic="F♯" />);
    await waitFor(() =>
      expect(renderScaleSpy).toHaveBeenCalledWith({ type: 'harmonic minor', root: 'F#' }),
    );
  });

  it('renders an arpeggio as the scale filtered to triad intervals', async () => {
    getScaleSpy.mockReturnValue([
      { string: 1, fret: 0, interval: '1P' },
      { string: 2, fret: 2, interval: '2M' },
      { string: 3, fret: 2, interval: '3M' },
      { string: 4, fret: 2, interval: '5P' },
    ]);

    render(<GuitarScale family="major-arpeggio" tonic="C" />);

    await waitFor(() => expect(renderSpy).toHaveBeenCalled());
    expect(getScaleSpy).toHaveBeenCalledWith({ type: 'major', root: 'C' });
    // Only 1P / 3M / 5P kept — the 2M is dropped.
    const dots = setDotsSpy.mock.calls[0][0] as Array<{ interval: string }>;
    expect(dots.map((d) => d.interval)).toEqual(['1P', '3M', '5P']);
    expect(renderScaleSpy).not.toHaveBeenCalled();
  });
});
