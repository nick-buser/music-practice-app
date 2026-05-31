/**
 * The chord-drill catalog: every block-chord drill expressed as a tiny
 * `ChordIdentity` instead of a hand-typed ABC string.
 *
 * This is the "input data" the refactor is about — 25 chord-type specs × two
 * 12-root lists = the 300 chord drills, each a few fields of JSON. `toAbc` (in
 * chord-identity.ts) regenerates the engravings; the parity test proves it
 * matches what `drills.ts` ships today. Nothing here is wired into `drills.ts`
 * yet (that's the next PR) — this module stands alone so the model can be
 * proven first.
 */

import type {
  Alteration,
  ChordIdentity,
  Root,
  SeventhType,
  TriadQuality,
} from './chord-identity';

/** The 25 selectable chord types — mirrors `CHORD_TYPES` in drills.ts. */
export const CHORD_TYPE_IDS = [
  'major', 'minor',
  'maj7', 'dom7', 'min7',
  'maj9', 'dom9', 'min9',
  'maj11', 'dom11', 'min11',
  'maj13', 'dom13', 'min13',
  '7b5', '7s5', '7b9', '7s9', '7s11', '13b9',
  'm7b5', 'dim7', 'maj7s11',
  '7alt', 'maj7s5',
] as const;
export type ChordTypeId = (typeof CHORD_TYPE_IDS)[number];

/** Which 12-root spelling list a chord type draws from. */
type RootSet = 'major' | 'minor';

/** The bare recipe for a chord type — everything but the root. */
interface ChordTypeSpec {
  quality: TriadQuality;
  seventh?: SeventhType;
  extensions: ChordIdentity['extensions'];
  alterations: Alteration[];
  rootSet: RootSet;
  /** Triads double the root an octave up (1·3·5·8). */
  doubleRoot?: boolean;
}

const A5 = (degree: Alteration['degree'], change: Alteration['change']): Alteration => ({ degree, change });

export const CHORD_TYPE_SPECS: Record<ChordTypeId, ChordTypeSpec> = {
  major: { quality: 'major', extensions: [], alterations: [], rootSet: 'major', doubleRoot: true },
  minor: { quality: 'minor', extensions: [], alterations: [], rootSet: 'minor', doubleRoot: true },

  maj7: { quality: 'major', seventh: 'maj7', extensions: [7], alterations: [], rootSet: 'major' },
  dom7: { quality: 'major', seventh: 'min7', extensions: [7], alterations: [], rootSet: 'major' },
  min7: { quality: 'minor', seventh: 'min7', extensions: [7], alterations: [], rootSet: 'minor' },

  maj9: { quality: 'major', seventh: 'maj7', extensions: [7, 9], alterations: [], rootSet: 'major' },
  dom9: { quality: 'major', seventh: 'min7', extensions: [7, 9], alterations: [], rootSet: 'major' },
  min9: { quality: 'minor', seventh: 'min7', extensions: [7, 9], alterations: [], rootSet: 'minor' },

  maj11: { quality: 'major', seventh: 'maj7', extensions: [7, 9, 11], alterations: [], rootSet: 'major' },
  dom11: { quality: 'major', seventh: 'min7', extensions: [7, 9, 11], alterations: [], rootSet: 'major' },
  min11: { quality: 'minor', seventh: 'min7', extensions: [7, 9, 11], alterations: [], rootSet: 'minor' },

  maj13: { quality: 'major', seventh: 'maj7', extensions: [7, 9, 11, 13], alterations: [], rootSet: 'major' },
  dom13: { quality: 'major', seventh: 'min7', extensions: [7, 9, 11, 13], alterations: [], rootSet: 'major' },
  min13: { quality: 'minor', seventh: 'min7', extensions: [7, 9, 11, 13], alterations: [], rootSet: 'minor' },

  '7b5': { quality: 'major', seventh: 'min7', extensions: [7], alterations: [A5(5, 'b')], rootSet: 'major' },
  '7s5': { quality: 'major', seventh: 'min7', extensions: [7], alterations: [A5(5, '#')], rootSet: 'major' },
  '7b9': { quality: 'major', seventh: 'min7', extensions: [7, 9], alterations: [A5(9, 'b')], rootSet: 'major' },
  '7s9': { quality: 'major', seventh: 'min7', extensions: [7, 9], alterations: [A5(9, '#')], rootSet: 'major' },
  '7s11': { quality: 'major', seventh: 'min7', extensions: [7, 11], alterations: [A5(11, '#')], rootSet: 'major' },
  '13b9': { quality: 'major', seventh: 'min7', extensions: [7, 9, 11, 13], alterations: [A5(9, 'b')], rootSet: 'major' },

  m7b5: { quality: 'dim', seventh: 'min7', extensions: [7], alterations: [], rootSet: 'minor' },
  dim7: { quality: 'dim', seventh: 'dim7', extensions: [7], alterations: [], rootSet: 'major' },
  maj7s11: { quality: 'major', seventh: 'maj7', extensions: [7, 11], alterations: [A5(11, '#')], rootSet: 'major' },

  '7alt': { quality: 'major', seventh: 'min7', extensions: [7, 9], alterations: [A5(5, '#'), A5(9, 'b'), A5(9, '#')], rootSet: 'major' },
  maj7s5: { quality: 'major', seventh: 'maj7', extensions: [7], alterations: [A5(5, '#')], rootSet: 'major' },
};

/** A root with the drill-id stem and display tonic the existing data uses. */
interface RootEntry {
  idBase: string;
  tonic: string;
  root: Root;
}

const R = (idBase: string, tonic: string, letter: Root['letter'], accidental: Root['accidental']): RootEntry => ({
  idBase, tonic, root: { letter, accidental },
});

/** Major-key spellings (Cmaj7, F♯7, D♭13 …). */
export const MAJOR_ROOTS: RootEntry[] = [
  R('c', 'C', 'C', 'natural'), R('g', 'G', 'G', 'natural'), R('d', 'D', 'D', 'natural'),
  R('a', 'A', 'A', 'natural'), R('e', 'E', 'E', 'natural'), R('b', 'B', 'B', 'natural'),
  R('fs', 'F♯', 'F', 'sharp'), R('f', 'F', 'F', 'natural'), R('bb', 'B♭', 'B', 'flat'),
  R('eb', 'E♭', 'E', 'flat'), R('ab', 'A♭', 'A', 'flat'), R('db', 'D♭', 'D', 'flat'),
];

/** Minor-key spellings (Am7, C♯m7, B♭m7 …) — note C♯ not D♭, etc. */
export const MINOR_ROOTS: RootEntry[] = [
  R('a', 'A', 'A', 'natural'), R('e', 'E', 'E', 'natural'), R('b', 'B', 'B', 'natural'),
  R('fs', 'F♯', 'F', 'sharp'), R('cs', 'C♯', 'C', 'sharp'), R('d', 'D', 'D', 'natural'),
  R('g', 'G', 'G', 'natural'), R('c', 'C', 'C', 'natural'), R('f', 'F', 'F', 'natural'),
  R('bb', 'B♭', 'B', 'flat'), R('eb', 'E♭', 'E', 'flat'), R('ab', 'A♭', 'A', 'flat'),
];

/** Build the full `ChordIdentity` for a chord type rooted on `root`. */
export function buildChordIdentity(type: ChordTypeId, root: Root): ChordIdentity {
  const spec = CHORD_TYPE_SPECS[type];
  return {
    root,
    quality: spec.quality,
    seventh: spec.seventh,
    extensions: [...spec.extensions],
    alterations: spec.alterations.map((a) => ({ ...a })),
    voicing: { type: 'block', inversion: 0, rootOctave: 4, doubleRoot: spec.doubleRoot },
  };
}

export interface ChordDrillEntry {
  /** Matches the drill id in drills.ts, e.g. "c-maj7-chord". */
  id: string;
  type: ChordTypeId;
  tonic: string;
  identity: ChordIdentity;
}

/** Every chord drill (300 of them) as an identity, keyed by its drills.ts id. */
export function chordDrillCatalog(): ChordDrillEntry[] {
  const out: ChordDrillEntry[] = [];
  for (const type of CHORD_TYPE_IDS) {
    const roots = CHORD_TYPE_SPECS[type].rootSet === 'minor' ? MINOR_ROOTS : MAJOR_ROOTS;
    for (const { idBase, tonic, root } of roots) {
      out.push({ id: `${idBase}-${type}-chord`, type, tonic, identity: buildChordIdentity(type, root) });
    }
  }
  return out;
}
