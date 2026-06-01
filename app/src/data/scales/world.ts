/**
 * World-music scales that sit on 12-tone equal temperament (so they engrave on
 * the staff and map onto the guitar fretboard). Phase 1: the Japanese
 * pentatonics. Microtonal traditions (true Carnatic gamaka, Hindustani shruti)
 * are a later phase with their own notation.
 *
 * Each scale is *data* — a root and a set of degrees ({diatonic step, semitones})
 * — from which the staff ABC and the fretboard are derived. No hand-typed
 * engravings, consistent with how chords work.
 */

export type ScaleRegion = 'japanese' | 'chinese';

export interface ScaleDegree {
  /** Diatonic letter steps above the root (0 = root, 1 = next letter, …). */
  step: number;
  /** Semitones above the root. */
  semitones: number;
}

export interface WorldScale {
  /** id stem used in drill ids + as the TechniqueFamily, e.g. "hirajoshi". */
  id: string;
  /** Display name. */
  name: string;
  region: ScaleRegion;
  /** Tonal scale-type name, for the guitar fretboard (fretboard.js / Tonal). */
  tonalType: string;
  /** Intervals to register with Tonal when it doesn't already know the scale. */
  registerIntervals?: string[];
  /** Ascending degrees (the octave is appended at render time). */
  degrees: ScaleDegree[];
}

const d = (step: number, semitones: number): ScaleDegree => ({ step, semitones });

export const JAPANESE_SCALES: WorldScale[] = [
  // C D E♭ G A♭
  {
    id: 'hirajoshi',
    name: 'Hirajōshi',
    region: 'japanese',
    tonalType: 'hirajoshi',
    degrees: [d(0, 0), d(1, 2), d(2, 3), d(4, 7), d(5, 8)],
  },
  // C D♭ F G B♭  (a.k.a. Insen) — not in Tonal, registered below.
  {
    id: 'in-sen',
    name: 'In',
    region: 'japanese',
    tonalType: 'in sen',
    registerIntervals: ['1P', '2m', '4P', '5P', '7m'],
    degrees: [d(0, 0), d(1, 1), d(3, 5), d(4, 7), d(6, 10)],
  },
  // C D F G A — not in Tonal, registered below.
  {
    id: 'yo',
    name: 'Yo',
    region: 'japanese',
    tonalType: 'yo',
    registerIntervals: ['1P', '2M', '4P', '5P', '6M'],
    degrees: [d(0, 0), d(1, 2), d(3, 5), d(4, 7), d(5, 9)],
  },
  // C D♭ F G♭ B♭
  {
    id: 'iwato',
    name: 'Iwato',
    region: 'japanese',
    tonalType: 'iwato',
    degrees: [d(0, 0), d(1, 1), d(3, 5), d(4, 6), d(6, 10)],
  },
  // C D E♭ G A
  {
    id: 'kumoi',
    name: 'Kumoi',
    region: 'japanese',
    tonalType: 'kumoi',
    degrees: [d(0, 0), d(1, 2), d(2, 3), d(4, 7), d(5, 9)],
  },
];

// The Chinese five-tone modes (五声音阶: gōng/shāng/jué/zhǐ/yǔ) — the rotations
// of the pentatonic. All five are already in Tonal, so the guitar view needs no
// registration.
export const CHINESE_SCALES: WorldScale[] = [
  // C D E G A  (major pentatonic)
  {
    id: 'gong',
    name: 'Gōng',
    region: 'chinese',
    tonalType: 'major pentatonic',
    degrees: [d(0, 0), d(1, 2), d(2, 4), d(4, 7), d(5, 9)],
  },
  // C D F G B♭
  {
    id: 'shang',
    name: 'Shāng',
    region: 'chinese',
    tonalType: 'egyptian',
    degrees: [d(0, 0), d(1, 2), d(3, 5), d(4, 7), d(6, 10)],
  },
  // C E♭ F A♭ B♭
  {
    id: 'jue',
    name: 'Jué',
    region: 'chinese',
    tonalType: 'malkos raga',
    degrees: [d(0, 0), d(2, 3), d(3, 5), d(5, 8), d(6, 10)],
  },
  // C D F G A
  {
    id: 'zhi',
    name: 'Zhǐ',
    region: 'chinese',
    tonalType: 'ritusen',
    degrees: [d(0, 0), d(1, 2), d(3, 5), d(4, 7), d(5, 9)],
  },
  // C E♭ F G B♭  (minor pentatonic)
  {
    id: 'yu',
    name: 'Yǔ',
    region: 'chinese',
    tonalType: 'minor pentatonic',
    degrees: [d(0, 0), d(2, 3), d(3, 5), d(4, 7), d(6, 10)],
  },
];

export const WORLD_SCALES: WorldScale[] = [...JAPANESE_SCALES, ...CHINESE_SCALES];

export const WORLD_SCALE_BY_FAMILY: Map<string, WorldScale> = new Map(
  WORLD_SCALES.map((s) => [s.id, s]),
);
