/**
 * Map our chord type + root to a playable guitar grip from chords-db, shaped
 * for svguitar.
 *
 * Heavy module (imports the chords-db JSON) — only ever reached via the dynamic
 * import in GuitarChord, so the chord database stays out of the main bundle.
 */
import guitarDb from '@tombatossals/chords-db/lib/guitar.json';

import type { ChordType } from '../data/drills';
import { GUITAR_CHORD_SUFFIX } from './support';

/** svguitar finger: [string, fret] or [string, fret, label]; fret 0 = open, 'x' = muted. */
export type GuitarFinger = [number, number | 'x'] | [number, number | 'x', string];
export interface GuitarBarre {
  fromString: number;
  toString: number;
  fret: number;
}
export interface GuitarShape {
  fingers: GuitarFinger[];
  barres: GuitarBarre[];
  /** Starting fret of the diagram window (chords-db baseFret). */
  position: number;
}

interface DbPosition {
  frets: number[];
  fingers: number[];
  baseFret: number;
  barres: number[];
}

// chords-db `frets` are low-E-first (index 0); svguitar strings are 1 = high e,
// 6 = low E. So svguitar string = 6 - index.
function svguitarString(dbIndex: number): number {
  return 6 - dbIndex;
}

function toShape(pos: DbPosition): GuitarShape {
  const barreFrets = new Set(pos.barres);
  const fingers: GuitarFinger[] = [];
  for (let i = 0; i < 6; i++) {
    const string = svguitarString(i);
    const fret = pos.frets[i];
    if (fret === -1) {
      fingers.push([string, 'x']);
    } else if (fret === 0) {
      fingers.push([string, 0]);
    } else if (!barreFrets.has(fret)) {
      // Strings under a barre are covered by it — don't double-draw a dot.
      const finger = pos.fingers[i];
      fingers.push(finger > 0 ? [string, fret, String(finger)] : [string, fret]);
    }
  }

  const barres: GuitarBarre[] = pos.barres.map((fret) => {
    const strings: number[] = [];
    for (let i = 0; i < 6; i++) if (pos.frets[i] === fret) strings.push(svguitarString(i));
    return { fromString: Math.max(...strings), toString: Math.min(...strings), fret };
  });

  return { fingers, barres, position: pos.baseFret };
}

/** A guitar grip for `type` rooted on `pitchClass` (0–11), or null if none. */
export function guitarChordShape(type: ChordType, pitchClass: number): GuitarShape | null {
  const suffix = GUITAR_CHORD_SUFFIX[type];
  if (!suffix) return null;
  const dbKey = guitarDb.keys[pitchClass]?.replace('#', 'sharp');
  if (!dbKey) return null;
  const entry = guitarDb.chords[dbKey]?.find((c) => c.suffix === suffix);
  const position = entry?.positions?.[0];
  return position ? toShape(position) : null;
}
