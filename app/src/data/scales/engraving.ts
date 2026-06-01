/**
 * Generate the ascending one-octave ABC line for a world scale on any root.
 *
 * Spelling mirrors the chord model: each degree's letter comes from its
 * diatonic step above the root, and the accidental from the semitone interval.
 * Rendered in K:C with explicit accidentals, one bar in `n/4` (n = note count).
 */
import type { RootAccidental, RootLetter } from '../chord-identity';
import type { WorldScale } from './world';

const LETTERS: RootLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC: Record<RootLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ROOT_ALTER: Record<RootAccidental, number> = { natural: 0, sharp: 1, flat: -1 };
const ALTER_TO_ABC: Record<number, string> = { [-2]: '__', [-1]: '_', 0: '', 1: '^', 2: '^^' };

function normalizeAlter(raw: number): number {
  let a = ((raw % 12) + 12) % 12;
  if (a > 6) a -= 12;
  return a;
}

function abcToken(letter: RootLetter, alter: number, octave: number): string {
  const lower = octave >= 5;
  const marks = lower ? "'".repeat(octave - 5) : ','.repeat(4 - octave);
  return ALTER_TO_ABC[alter] + (lower ? letter.toLowerCase() : letter) + marks;
}

/** The bracketed-free ABC measure for the scale, e.g. "CD_EG_Ac |". */
export function scaleAbcMeasure(
  scale: WorldScale,
  rootLetter: RootLetter,
  rootAccidental: RootAccidental,
): string {
  const rootIdx = LETTERS.indexOf(rootLetter);
  const rootPc = NATURAL_PC[rootLetter] + ROOT_ALTER[rootAccidental];
  const rootMidi = 12 * (4 + 1) + rootPc; // octave 4
  const degrees = [...scale.degrees, { step: 7, semitones: 12 }]; // + the octave

  const tokens = degrees.map(({ step, semitones }) => {
    const letter = LETTERS[(rootIdx + step) % 7];
    const targetMidi = rootMidi + semitones;
    const alter = normalizeAlter(rootPc + semitones - NATURAL_PC[letter]);
    const octave = Math.round((targetMidi - NATURAL_PC[letter] - alter) / 12) - 1;
    return abcToken(letter, alter, octave);
  });
  return `${tokens.join('')} |`;
}

/** A full Verovio-ready ABC document for the scale. */
export function scaleAbc(
  scale: WorldScale,
  rootLetter: RootLetter,
  rootAccidental: RootAccidental,
  title: string,
): string {
  const beats = scale.degrees.length + 1; // notes incl. the octave
  return `X:1\nT:${title}\nM:${beats}/4\nL:1/4\nK:C\n${scaleAbcMeasure(scale, rootLetter, rootAccidental)}`;
}
