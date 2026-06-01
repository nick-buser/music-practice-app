/** Note-name helpers shared by the guitar views. */

const BASE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Tonic display ("F♯", "B♭") → ASCII note Tonal/chords-db understand ("F#", "Bb"). */
export function toAsciiNote(tonic: string): string {
  return tonic.replace(/♯/g, '#').replace(/♭/g, 'b');
}

/** Note name → pitch class 0–11 (C=0). Accepts ♯/♭ or #/b, single or double. */
export function noteToPitchClass(note: string): number {
  const m = /^([A-G])([#b]*)$/.exec(toAsciiNote(note));
  if (!m) return 0;
  let pc = BASE_PC[m[1]];
  for (const accidental of m[2]) pc += accidental === '#' ? 1 : -1;
  return ((pc % 12) + 12) % 12;
}
