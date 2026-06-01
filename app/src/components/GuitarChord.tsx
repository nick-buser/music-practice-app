import { useEffect, useRef, useState } from 'react';

import type { ChordType } from '../data/drills';

interface Props {
  type: ChordType;
  /** Root pitch class 0–11. */
  pitchClass: number;
  /** Chord symbol shown above the grid. */
  name: string;
}

// Theme-matched colours (svguitar takes literal SVG colours, not CSS vars).
const CONFIG = {
  backgroundColor: 'transparent',
  color: '#5b82b8', // grid (shoal)
  fingerColor: '#4afdc6', // dots (lumen)
  fingerTextColor: '#03060f',
  textColor: '#eef3fa', // labels (foam)
  titleColor: '#eef3fa',
  fontFamily: 'inherit',
  strokeWidth: 1.5,
} as const;

/**
 * A guitar chord diagram (chords-db grip rendered by svguitar). Both the grip
 * data and the renderer are dynamically imported, so they never enter the main
 * (public) bundle — they load only when the guitar view is opened. Shows a
 * graceful note if the chord has no common guitar voicing.
 */
export function GuitarChord({ type, pitchClass, name }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void (async () => {
      const [{ guitarChordShape }, svguitar] = await Promise.all([
        import('../guitar/chord-shape'),
        import('svguitar'),
      ]);
      const host = hostRef.current;
      if (cancelled || !host) return;
      const shape = guitarChordShape(type, pitchClass);
      if (!shape) {
        setFailed(true);
        return;
      }
      host.replaceChildren();
      new svguitar.SVGuitarChord(host)
        .configure(CONFIG)
        .chord({
          fingers: shape.fingers,
          barres: shape.barres,
          position: shape.position,
          title: name,
        })
        .draw();
    })();
    return () => {
      cancelled = true;
    };
  }, [type, pitchClass, name]);

  if (failed) {
    return <div className="guitar-unsupported">no common guitar voicing</div>;
  }
  return <div ref={hostRef} className="guitar-diagram" role="img" aria-label={`${name} chord`} />;
}
