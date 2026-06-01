import { useEffect, useRef } from 'react';

import { toAsciiNote } from '../guitar/notes';
import { guitarScaleSpec } from '../guitar/scale-spec';
import type { TechniqueFamily } from '../data/schemas';

interface Props {
  family: TechniqueFamily;
  /** Tonic display name, e.g. "C", "F♯", "B♭". */
  tonic: string;
}

const FRET_COUNT = 5;

// fretboard.js options (literal colours; theme-matched for the dark engraving).
const OPTIONS = {
  fretCount: FRET_COUNT,
  stringColor: '#5b82b8',
  fretColor: '#33455f',
  nutColor: '#b6c8df',
  middleFretColor: '#33455f',
  dotFill: '#4afdc6',
  dotStrokeColor: '#4afdc6',
  fretNumbersColor: '#b6c8df',
  scaleFrets: true,
  crop: true,
} as const;

/**
 * A guitar fretboard diagram for a scale or arpeggio (fretboard.js, dynamically
 * imported). Scales use `renderScale`; arpeggios render the parent scale
 * filtered to the triad's intervals.
 */
export function GuitarScale({ family, tonic }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const spec = guitarScaleSpec(family);
      if (!spec) return;
      const { Fretboard, FretboardSystem } = await import('@moonwave99/fretboard.js');
      const host = hostRef.current;
      if (cancelled || !host) return;
      host.replaceChildren();
      const root = toAsciiNote(tonic);
      const fretboard = new Fretboard({ el: host, ...OPTIONS });

      if (spec.kind === 'scale') {
        fretboard.renderScale({ type: spec.scaleType, root });
      } else {
        const positions = new FretboardSystem({ fretCount: FRET_COUNT }).getScale({
          type: spec.scaleType,
          root,
        });
        const dots = positions.filter(
          (p) => p.interval !== undefined && spec.intervals.includes(p.interval),
        );
        fretboard.setDots(dots).render();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [family, tonic]);

  return (
    <div ref={hostRef} className="guitar-fretboard" role="img" aria-label={`${tonic} ${family}`} />
  );
}
