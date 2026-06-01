/**
 * Map a scale/arpeggio drill family to what fretboard.js should draw.
 *
 *  - scales use Tonal scale names via fretboard.js `renderScale`
 *  - arpeggios are the parent scale filtered to the triad's intervals
 *
 * The world scales Tonal doesn't ship (In, Yo) are registered with the shared
 * Tonal scale-type dictionary at import, so fretboard.js can resolve them too.
 */
import { add as addScaleType } from '@tonaljs/scale-type';

import { JAPANESE_SCALES, WORLD_SCALE_BY_FAMILY } from '../data/scales/world';
import type { TechniqueFamily } from '../data/schemas';

for (const scale of JAPANESE_SCALES) {
  if (scale.registerIntervals) addScaleType(scale.registerIntervals, scale.tonalType);
}

export type GuitarScaleSpec =
  | { kind: 'scale'; scaleType: string }
  | { kind: 'arpeggio'; scaleType: string; intervals: string[] };

const MAJOR_TRIAD = ['1P', '3M', '5P'];
const MINOR_TRIAD = ['1P', '3m', '5P'];

export function guitarScaleSpec(family: TechniqueFamily): GuitarScaleSpec | null {
  switch (family) {
    case 'major':
      return { kind: 'scale', scaleType: 'major' };
    case 'natural-minor':
      return { kind: 'scale', scaleType: 'minor' };
    case 'harmonic-minor':
      return { kind: 'scale', scaleType: 'harmonic minor' };
    case 'melodic-minor':
      return { kind: 'scale', scaleType: 'melodic minor' };
    case 'major-arpeggio':
      return { kind: 'arpeggio', scaleType: 'major', intervals: MAJOR_TRIAD };
    case 'minor-arpeggio':
      return { kind: 'arpeggio', scaleType: 'minor', intervals: MINOR_TRIAD };
  }

  const world = WORLD_SCALE_BY_FAMILY.get(family);
  if (world) return { kind: 'scale', scaleType: world.tonalType };
  return null; // chords are handled by GuitarChord
}
