import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { chordSpy, shapeSpy } = vi.hoisted(() => ({ chordSpy: vi.fn(), shapeSpy: vi.fn() }));

// svguitar can't render in jsdom; mock it and capture the chord spec.
vi.mock('svguitar', () => ({
  SVGuitarChord: class {
    configure() {
      return this;
    }
    chord(spec: unknown) {
      chordSpy(spec);
      return this;
    }
    draw() {
      return this;
    }
  },
}));
vi.mock('../guitar/chord-shape', () => ({
  guitarChordShape: (...args: unknown[]) => shapeSpy(...args),
}));

import { GuitarChord } from './GuitarChord';

describe('GuitarChord', () => {
  beforeEach(() => {
    chordSpy.mockReset();
    shapeSpy.mockReset();
  });

  it('draws the chords-db grip for a supported chord', async () => {
    const shape = { fingers: [[6, 'x']], barres: [], position: 3 };
    shapeSpy.mockReturnValue(shape);

    render(<GuitarChord type="maj7" pitchClass={0} name="Cmaj7" />);

    await waitFor(() => expect(chordSpy).toHaveBeenCalledTimes(1));
    expect(shapeSpy).toHaveBeenCalledWith('maj7', 0);
    expect(chordSpy).toHaveBeenCalledWith({
      fingers: shape.fingers,
      barres: shape.barres,
      position: 3,
      title: 'Cmaj7',
    });
  });

  it('shows a fallback note when there is no guitar voicing', async () => {
    shapeSpy.mockReturnValue(null);

    render(<GuitarChord type="maj7s11" pitchClass={0} name="Cmaj7♯11" />);

    expect(await screen.findByText(/no common guitar voicing/i)).toBeInTheDocument();
    expect(chordSpy).not.toHaveBeenCalled();
  });
});
