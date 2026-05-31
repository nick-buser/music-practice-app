import type { Drill, TechniqueFamily } from './schemas';

/**
 * The drills library: 12 major scales, 36 minor scales (12 keys × natural /
 * harmonic / melodic-ascending), 24 arpeggios (12 major + 12 minor), and 24
 * block chords (12 major triads + 12 minor triads).
 *
 * Engravings are minimal Verovio-ready ABC. For scales/arpeggios the notes
 * follow the key signature for accidentals; we only write `^` or `=` when a
 * variant deliberately raises or naturals a degree (harmonic minor's #7,
 * melodic-ascending's #6/#7). Chords are vertical `[...]` blocks held as whole
 * notes — a single bar that reads as a struck chord rather than a melodic line.
 *
 * Tracking state (comfort / lastTouched / bpmCurrent / reps) is deterministic
 * mock data seeded off each drill's id, so the cards have plausible variation
 * without anyone having to maintain a 96-row hand-tuned table.
 */

const abc = (title: string, key: string, notes: string): string =>
  `X:1\nT:${title}\nM:4/4\nL:1/4\nK:${key}\n${notes}`;

/* ─── Tracking-state seed ───────────────────────────────── */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
function trackingFor(id: string, difficulty: number): {
  comfort: number;
  lastTouched: string | null;
  bpmTarget: number;
  bpmCurrent: number;
  reps: number;
} {
  const r = rng(hash(id));
  const base = 0.95 - difficulty * 0.7;
  const comfort = Math.max(0.05, Math.min(0.98, base + (r() - 0.5) * 0.3));
  const bpmTarget = comfort > 0.75 ? 140 : 132;
  const bpmCurrent = Math.round(
    bpmTarget * Math.min(1, comfort + 0.05 + r() * 0.05),
  );
  const reps = Math.round(60 + comfort * 280 + r() * 40);
  const daysAgo = Math.floor(r() * 30);
  const d = new Date('2026-05-29');
  d.setDate(d.getDate() - daysAgo);
  return {
    comfort,
    lastTouched: d.toISOString().slice(0, 10),
    bpmTarget,
    bpmCurrent,
    reps,
  };
}

interface Spec {
  id: string;
  name: string;
  tonic: string;
  family: TechniqueFamily;
  variant?: 'natural' | 'harmonic' | 'melodic';
  abc: string;
  difficulty: number;
}

function build(s: Spec): Drill {
  return { ...s, ...trackingFor(s.id, s.difficulty) };
}

/* ─── Difficulty bands (circle of fifths distance from C/Am) ───── */
const KEY_DIFF: Record<string, number> = {
  C: 0.0, G: 0.05, D: 0.1, A: 0.2, E: 0.35, B: 0.55, 'F#': 0.85,
  F: 0.1, Bb: 0.2, Eb: 0.3, Ab: 0.55, Db: 0.8,
  Am: 0.0, Em: 0.1, Bm: 0.2, 'F#m': 0.35, 'C#m': 0.55,
  Dm: 0.05, Gm: 0.15, Cm: 0.3, Fm: 0.5, Bbm: 0.7, Ebm: 0.85, Abm: 0.95,
};

/* ─── 12 major scales ─────────────────────────────────── */
const MAJORS: Spec[] = [
  ['c-major',  'C major',  'C',  'C',  'CDEF | GABc |'],
  ['g-major',  'G major',  'G',  'G',  'GABc | defg |'],
  ['d-major',  'D major',  'D',  'D',  'DEFG | ABcd |'],
  ['a-major',  'A major',  'A',  'A',  'ABcd | efga |'],
  ['e-major',  'E major',  'E',  'E',  'EFGA | Bcde |'],
  ['b-major',  'B major',  'B',  'B',  'Bcde | fgab |'],
  ['fs-major', 'F♯ major', 'F♯', 'F#', 'FGAB | cdef |'],
  ['f-major',  'F major',  'F',  'F',  'FGAB | cdef |'],
  ['bb-major', 'B♭ major', 'B♭', 'Bb', 'Bcde | fgab |'],
  ['eb-major', 'E♭ major', 'E♭', 'Eb', 'EFGA | Bcde |'],
  ['ab-major', 'A♭ major', 'A♭', 'Ab', 'ABcd | efga |'],
  ['db-major', 'D♭ major', 'D♭', 'Db', 'DEFG | ABcd |'],
].map(([id, name, tonic, key, notes]) => ({
  id,
  name,
  tonic,
  family: 'major' as TechniqueFamily,
  abc: abc(`${name} scale`, key, notes),
  difficulty: KEY_DIFF[key] ?? 0.5,
}));

/* ─── 12 minor tonics × 3 variants = 36 minor scales ───── */
const MINOR_KEYS: Array<[id: string, tonic: string, key: string, nat: string, harm: string, mel: string]> = [
  ['a',  'A',  'Am',  'ABcd | efga |', 'ABcd | ef^ga |', 'ABcd | e^f^ga |'],
  ['e',  'E',  'Em',  'EFGA | Bcde |', 'EFGA | Bc^de |', 'EFGA | B^c^de |'],
  ['b',  'B',  'Bm',  'Bcde | fgab |', 'Bcde | fg^ab |', 'Bcde | f^g^ab |'],
  ['fs', 'F♯', 'F#m', 'FGAB | cdef |', 'FGAB | cd^ef |', 'FGAB | c^d^ef |'],
  ['cs', 'C♯', 'C#m', 'CDEF | GABc |', 'CDEF | GA^Bc |', 'CDEF | G^A^Bc |'],
  ['d',  'D',  'Dm',  'DEFG | ABcd |', 'DEFG | AB^cd |', 'DEFG | A=B^cd |'],
  ['g',  'G',  'Gm',  'GABc | defg |', 'GABc | de^fg |', 'GABc | d=e^fg |'],
  ['c',  'C',  'Cm',  'CDEF | GABc |', 'CDEF | GA=Bc |', 'CDEF | G=A=Bc |'],
  ['f',  'F',  'Fm',  'FGAB | cdef |', 'FGAB | cd=ef |', 'FGAB | c=d=ef |'],
  ['bb', 'B♭', 'Bbm', 'Bcde | fgab |', 'Bcde | fg=ab |', 'Bcde | f=g=ab |'],
  ['eb', 'E♭', 'Ebm', 'EFGA | Bcde |', 'EFGA | Bc=de |', 'EFGA | B=c=de |'],
  ['ab', 'A♭', 'Abm', 'ABcd | efga |', 'ABcd | ef=ga |', 'ABcd | e=f=ga |'],
];

const MINORS: Spec[] = MINOR_KEYS.flatMap(([idBase, tonic, key, nat, harm, mel]) => {
  const diff = KEY_DIFF[key] ?? 0.5;
  return [
    { id: `${idBase}-natural-minor`,  name: `${tonic} natural minor`,        tonic, family: 'natural-minor'  as TechniqueFamily, variant: 'natural'  as const, abc: abc(`${tonic} natural minor`,        key, nat),  difficulty: diff },
    { id: `${idBase}-harmonic-minor`, name: `${tonic} harmonic minor`,       tonic, family: 'harmonic-minor' as TechniqueFamily, variant: 'harmonic' as const, abc: abc(`${tonic} harmonic minor`,       key, harm), difficulty: diff },
    { id: `${idBase}-melodic-minor`,  name: `${tonic} melodic minor`,        tonic, family: 'melodic-minor'  as TechniqueFamily, variant: 'melodic'  as const, abc: abc(`${tonic} melodic minor (asc.)`, key, mel),  difficulty: diff },
  ];
});

/* ─── 24 arpeggios (12 major + 12 minor, one octave asc/desc) ─── */
type ArpRow = [id: string, tonic: string, key: string, notes: string];

const MAJOR_ARP_KEYS: ArpRow[] = [
  ['c',  'C',  'C',  'CEGc | cGEC |'],
  ['g',  'G',  'G',  'GBdg | gdBG |'],
  ['d',  'D',  'D',  'DFAd | dAFD |'],
  ['a',  'A',  'A',  'ACEa | aECA |'],
  ['e',  'E',  'E',  'EGBe | eBGE |'],
  ['b',  'B',  'B',  'BdfB | Bfdb |'],
  ['fs', 'F♯', 'F#', 'FAcf | fcAF |'],
  ['f',  'F',  'F',  'FAcf | fcAF |'],
  ['bb', 'B♭', 'Bb', 'Bdfb | bfdB |'],
  ['eb', 'E♭', 'Eb', 'EGBe | eBGE |'],
  ['ab', 'A♭', 'Ab', 'ACEa | aECA |'],
  ['db', 'D♭', 'Db', 'DFAd | dAFD |'],
];

const MINOR_ARP_KEYS: ArpRow[] = [
  ['a',  'A',  'Am',  'ACEa | aECA |'],
  ['e',  'E',  'Em',  'EGBe | eBGE |'],
  ['b',  'B',  'Bm',  'Bdfb | bfdB |'],
  ['fs', 'F♯', 'F#m', 'FAcf | fcAF |'],
  ['cs', 'C♯', 'C#m', 'CEGc | cGEC |'],
  ['d',  'D',  'Dm',  'DFAd | dAFD |'],
  ['g',  'G',  'Gm',  'GBdg | gdBG |'],
  ['c',  'C',  'Cm',  'CEGc | cGEC |'],
  ['f',  'F',  'Fm',  'FAcf | fcAF |'],
  ['bb', 'B♭', 'Bbm', 'Bdfb | bfdB |'],
  ['eb', 'E♭', 'Ebm', 'EGBe | eBGE |'],
  ['ab', 'A♭', 'Abm', 'ACEa | aECA |'],
];

const ARPEGGIOS: Spec[] = [
  ...MAJOR_ARP_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-major-arp`,
    name: `${tonic} major arpeggio`,
    tonic,
    family: 'major-arpeggio' as TechniqueFamily,
    abc: abc(`${tonic} major arpeggio`, key, notes),
    difficulty: KEY_DIFF[key] ?? 0.5,
  })),
  ...MINOR_ARP_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-minor-arp`,
    name: `${tonic} minor arpeggio`,
    tonic,
    family: 'minor-arpeggio' as TechniqueFamily,
    abc: abc(`${tonic} minor arpeggio`, key, notes),
    difficulty: KEY_DIFF[key] ?? 0.5,
  })),
];

/* ─── 24 block chords (12 major triads + 12 minor triads) ──────
 * Chord blocks `[notes]4` render as a whole-note vertical stack — a single
 * struck chord per bar. Notes are the same letter sequence as the matching
 * arpeggio, just bracketed; key signature handles accidentals.
 */
type ChordRow = [id: string, tonic: string, key: string, notes: string];

const MAJOR_CHORD_KEYS: ChordRow[] = [
  ['c',  'C',  'C',  '[CEGc]4 |'],
  ['g',  'G',  'G',  '[GBdg]4 |'],
  ['d',  'D',  'D',  '[DFAd]4 |'],
  ['a',  'A',  'A',  '[ACEa]4 |'],
  ['e',  'E',  'E',  '[EGBe]4 |'],
  ['b',  'B',  'B',  '[Bdfb]4 |'],
  ['fs', 'F♯', 'F#', '[FAcf]4 |'],
  ['f',  'F',  'F',  '[FAcf]4 |'],
  ['bb', 'B♭', 'Bb', '[Bdfb]4 |'],
  ['eb', 'E♭', 'Eb', '[EGBe]4 |'],
  ['ab', 'A♭', 'Ab', '[ACEa]4 |'],
  ['db', 'D♭', 'Db', '[DFAd]4 |'],
];

const MINOR_CHORD_KEYS: ChordRow[] = [
  ['a',  'A',  'Am',  '[ACEa]4 |'],
  ['e',  'E',  'Em',  '[EGBe]4 |'],
  ['b',  'B',  'Bm',  '[Bdfb]4 |'],
  ['fs', 'F♯', 'F#m', '[FAcf]4 |'],
  ['cs', 'C♯', 'C#m', '[CEGc]4 |'],
  ['d',  'D',  'Dm',  '[DFAd]4 |'],
  ['g',  'G',  'Gm',  '[GBdg]4 |'],
  ['c',  'C',  'Cm',  '[CEGc]4 |'],
  ['f',  'F',  'Fm',  '[FAcf]4 |'],
  ['bb', 'B♭', 'Bbm', '[Bdfb]4 |'],
  ['eb', 'E♭', 'Ebm', '[EGBe]4 |'],
  ['ab', 'A♭', 'Abm', '[ACEa]4 |'],
];

const CHORDS: Spec[] = [
  ...MAJOR_CHORD_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-major-chord`,
    name: `${tonic} major chord`,
    tonic,
    family: 'major-chord' as TechniqueFamily,
    abc: abc(`${tonic} major chord`, key, notes),
    difficulty: KEY_DIFF[key] ?? 0.5,
  })),
  ...MINOR_CHORD_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-minor-chord`,
    name: `${tonic} minor chord`,
    tonic,
    family: 'minor-chord' as TechniqueFamily,
    abc: abc(`${tonic} minor chord`, key, notes),
    difficulty: KEY_DIFF[key] ?? 0.5,
  })),
];

/* ─── 36 seventh chords (12 maj7 + 12 dom7 + 12 m7) ──────────────
 * Each row is [idBase, tonic, K:sig, abc-notes]. The key signature is chosen
 * so the four chord tones (root / 3 / 5 / 7) come out with no explicit
 * accidentals — Verovio engraves the key sig and lets the letters be:
 *
 *   maj7  → key sig is the tonic major (e.g. Cmaj7 → K:C)
 *   dom7  → key sig is the resolution-key major / flat-7's home
 *           (e.g. C7 → K:F gives Bb, the b7 of C)
 *   m7    → key sig is the parallel minor (e.g. Cm7 → K:Cm gives Eb + Bb)
 */

type ChordRow7 = [id: string, tonic: string, key: string, notes: string];

const MAJ7_KEYS: ChordRow7[] = [
  ['c',  'C',  'C',  '[CEGB]4 |'],
  ['g',  'G',  'G',  '[GBdf]4 |'],
  ['d',  'D',  'D',  '[DFAc]4 |'],
  ['a',  'A',  'A',  '[ACEg]4 |'],
  ['e',  'E',  'E',  '[EGBd]4 |'],
  ['b',  'B',  'B',  '[Bdfa]4 |'],
  ['fs', 'F♯', 'F#', '[FAce]4 |'],
  ['f',  'F',  'F',  '[FACe]4 |'],
  ['bb', 'B♭', 'Bb', '[Bdfa]4 |'],
  ['eb', 'E♭', 'Eb', '[EGBd]4 |'],
  ['ab', 'A♭', 'Ab', '[ACEg]4 |'],
  ['db', 'D♭', 'Db', '[DFAc]4 |'],
];

const DOM7_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGB]4 |'],   // K:F → Bb
  ['g',  'G',  'C',  '[GBdf]4 |'],   // K:C → F natural
  ['d',  'D',  'G',  '[DFAc]4 |'],   // K:G → F#, C natural
  ['a',  'A',  'D',  '[ACEg]4 |'],   // K:D → C#, G natural
  ['e',  'E',  'A',  '[EGBd]4 |'],   // K:A → G#, D natural
  ['b',  'B',  'E',  '[Bdfa]4 |'],   // K:E → D#, A natural
  ['fs', 'F♯', 'B',  '[FAce]4 |'],   // K:B → A#, E natural
  ['f',  'F',  'Bb', '[FACe]4 |'],   // K:Bb → Eb
  ['bb', 'B♭', 'Eb', '[Bdfa]4 |'],   // K:Eb → Bb, Ab
  ['eb', 'E♭', 'Ab', '[EGBd]4 |'],   // K:Ab → Eb, Db
  ['ab', 'A♭', 'Db', '[ACEg]4 |'],   // K:Db → Ab, Gb
  ['db', 'D♭', 'Gb', '[DFAc]4 |'],   // K:Gb (6 flats) → Db, Cb
];

const MIN7_KEYS: ChordRow7[] = [
  ['a',  'A',  'Am',  '[ACEg]4 |'],
  ['e',  'E',  'Em',  '[EGBd]4 |'],
  ['b',  'B',  'Bm',  '[Bdfa]4 |'],
  ['fs', 'F♯', 'F#m', '[FAce]4 |'],
  ['cs', 'C♯', 'C#m', '[CEGB]4 |'],
  ['d',  'D',  'Dm',  '[DFAc]4 |'],
  ['g',  'G',  'Gm',  '[GBdf]4 |'],
  ['c',  'C',  'Cm',  '[CEGB]4 |'],
  ['f',  'F',  'Fm',  '[FACe]4 |'],
  ['bb', 'B♭', 'Bbm', '[Bdfa]4 |'],
  ['eb', 'E♭', 'Ebm', '[EGBd]4 |'],
  ['ab', 'A♭', 'Abm', '[ACEg]4 |'],
];

const SEVENTHS: Spec[] = [
  ...MAJ7_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-maj7-chord`,
    name: `${tonic}maj7`,
    tonic,
    family: 'maj7-chord' as TechniqueFamily,
    abc: abc(`${tonic}maj7 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.05,
  })),
  ...DOM7_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-dom7-chord`,
    name: `${tonic}7`,
    tonic,
    family: 'dom7-chord' as TechniqueFamily,
    abc: abc(`${tonic}7 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.05,
  })),
  ...MIN7_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-min7-chord`,
    name: `${tonic}m7`,
    tonic,
    family: 'min7-chord' as TechniqueFamily,
    abc: abc(`${tonic}m7 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.05,
  })),
];

/* ─── 36 ninth chords (12 maj9 + 12 dom9 + 12 m9) ────────────────
 * 9th chords stack a 5th chord tone on top of the 7th block — the 9 is a
 * whole step above the octave, which in ABC pitch order is just the next
 * letter after the 7th. So Cmaj9 = [CEGBd]4 (root + every-other letter,
 * five steps). For B-rooted chords the 9th lands at c' (C6).
 *
 * Like the 7ths, the key signature is chosen per chord type so the five
 * chord tones land without explicit accidentals: maj9 in tonic major,
 * dom9 in the resolution-key major, m9 in parallel minor.
 */

const MAJ9_KEYS: ChordRow7[] = [
  ['c',  'C',  'C',  '[CEGBd]4 |'],
  ['g',  'G',  'G',  '[GBdfa]4 |'],
  ['d',  'D',  'D',  '[DFAce]4 |'],
  ['a',  'A',  'A',  '[ACegb]4 |'],
  ['e',  'E',  'E',  '[EGBdf]4 |'],
  ['b',  'B',  'B',  "[Bdfac']4 |"],
  ['fs', 'F♯', 'F#', '[FAceg]4 |'],
  ['f',  'F',  'F',  '[FAceg]4 |'],
  ['bb', 'B♭', 'Bb', "[Bdfac']4 |"],
  ['eb', 'E♭', 'Eb', '[EGBdf]4 |'],
  ['ab', 'A♭', 'Ab', '[ACegb]4 |'],
  ['db', 'D♭', 'Db', '[DFAce]4 |'],
];

const DOM9_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGBd]4 |'],   // K:F → Bb (b7)
  ['g',  'G',  'C',  '[GBdfa]4 |'],   // K:C
  ['d',  'D',  'G',  '[DFAce]4 |'],   // K:G
  ['a',  'A',  'D',  '[ACegb]4 |'],   // K:D
  ['e',  'E',  'A',  '[EGBdf]4 |'],   // K:A
  ['b',  'B',  'E',  "[Bdfac']4 |"],  // K:E
  ['fs', 'F♯', 'B',  '[FAceg]4 |'],   // K:B
  ['f',  'F',  'Bb', '[FAceg]4 |'],   // K:Bb
  ['bb', 'B♭', 'Eb', "[Bdfac']4 |"],  // K:Eb
  ['eb', 'E♭', 'Ab', '[EGBdf]4 |'],   // K:Ab
  ['ab', 'A♭', 'Db', '[ACegb]4 |'],   // K:Db
  ['db', 'D♭', 'Gb', '[DFAce]4 |'],   // K:Gb (6 flats)
];

const MIN9_KEYS: ChordRow7[] = [
  ['a',  'A',  'Am',  '[ACegb]4 |'],
  ['e',  'E',  'Em',  '[EGBdf]4 |'],
  ['b',  'B',  'Bm',  "[Bdfac']4 |"],
  ['fs', 'F♯', 'F#m', '[FAceg]4 |'],
  ['cs', 'C♯', 'C#m', '[CEGBd]4 |'],
  ['d',  'D',  'Dm',  '[DFAce]4 |'],
  ['g',  'G',  'Gm',  '[GBdfa]4 |'],
  ['c',  'C',  'Cm',  '[CEGBd]4 |'],
  ['f',  'F',  'Fm',  '[FAceg]4 |'],
  ['bb', 'B♭', 'Bbm', "[Bdfac']4 |"],
  ['eb', 'E♭', 'Ebm', '[EGBdf]4 |'],
  ['ab', 'A♭', 'Abm', '[ACegb]4 |'],
];

const NINTHS: Spec[] = [
  ...MAJ9_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-maj9-chord`,
    name: `${tonic}maj9`,
    tonic,
    family: 'maj9-chord' as TechniqueFamily,
    abc: abc(`${tonic}maj9 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.1,
  })),
  ...DOM9_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-dom9-chord`,
    name: `${tonic}9`,
    tonic,
    family: 'dom9-chord' as TechniqueFamily,
    abc: abc(`${tonic}9 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.1,
  })),
  ...MIN9_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-min9-chord`,
    name: `${tonic}m9`,
    tonic,
    family: 'min9-chord' as TechniqueFamily,
    abc: abc(`${tonic}m9 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.1,
  })),
];

/* ─── 36 eleventh chords (12 maj11 + 12 dom11 + 12 m11) ────────────
 * 11th chords add a 6th tone (a 4th above the octave) on top of the 9th
 * block. In ABC pitch order it's the next "skip-one" letter after the 9th,
 * so Cmaj11 = [CEGBdf]4. For B/Bb-rooted chords the stack runs up into
 * the C6 / E6 register: Bmaj11 = [Bdfac'e']4.
 *
 * Key signature is chosen as in the 9ths: tonic major for maj11, the
 * resolution-key major for dom11 (so the b7 lands without an explicit
 * accidental), parallel minor for m11. The textbook root-position
 * voicing is rendered without omitting tones — even when the 11 clashes
 * with the major 3rd (maj11). Players can omit tones at practice time.
 */

const MAJ11_KEYS: ChordRow7[] = [
  ['c',  'C',  'C',  '[CEGBdf]4 |'],
  ['g',  'G',  'G',  "[GBdfac']4 |"],
  ['d',  'D',  'D',  '[DFAceg]4 |'],
  ['a',  'A',  'A',  "[Acegbd']4 |"],
  ['e',  'E',  'E',  '[EGBdfa]4 |'],
  ['b',  'B',  'B',  "[Bdfac'e']4 |"],
  ['fs', 'F♯', 'F#', '[FAcegb]4 |'],
  ['f',  'F',  'F',  '[FAcegb]4 |'],
  ['bb', 'B♭', 'Bb', "[Bdfac'e']4 |"],
  ['eb', 'E♭', 'Eb', '[EGBdfa]4 |'],
  ['ab', 'A♭', 'Ab', "[Acegbd']4 |"],
  ['db', 'D♭', 'Db', '[DFAceg]4 |'],
];

const DOM11_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGBdf]4 |'],
  ['g',  'G',  'C',  "[GBdfac']4 |"],
  ['d',  'D',  'G',  '[DFAceg]4 |'],
  ['a',  'A',  'D',  "[Acegbd']4 |"],
  ['e',  'E',  'A',  '[EGBdfa]4 |'],
  ['b',  'B',  'E',  "[Bdfac'e']4 |"],
  ['fs', 'F♯', 'B',  '[FAcegb]4 |'],
  ['f',  'F',  'Bb', '[FAcegb]4 |'],
  ['bb', 'B♭', 'Eb', "[Bdfac'e']4 |"],
  ['eb', 'E♭', 'Ab', '[EGBdfa]4 |'],
  ['ab', 'A♭', 'Db', "[Acegbd']4 |"],
  ['db', 'D♭', 'Gb', '[DFAceg]4 |'],
];

const MIN11_KEYS: ChordRow7[] = [
  ['a',  'A',  'Am',  "[Acegbd']4 |"],
  ['e',  'E',  'Em',  '[EGBdfa]4 |'],
  ['b',  'B',  'Bm',  "[Bdfac'e']4 |"],
  ['fs', 'F♯', 'F#m', '[FAcegb]4 |'],
  ['cs', 'C♯', 'C#m', '[CEGBdf]4 |'],
  ['d',  'D',  'Dm',  '[DFAceg]4 |'],
  ['g',  'G',  'Gm',  "[GBdfac']4 |"],
  ['c',  'C',  'Cm',  '[CEGBdf]4 |'],
  ['f',  'F',  'Fm',  '[FAcegb]4 |'],
  ['bb', 'B♭', 'Bbm', "[Bdfac'e']4 |"],
  ['eb', 'E♭', 'Ebm', '[EGBdfa]4 |'],
  ['ab', 'A♭', 'Abm', "[Acegbd']4 |"],
];

const ELEVENTHS: Spec[] = [
  ...MAJ11_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-maj11-chord`,
    name: `${tonic}maj11`,
    tonic,
    family: 'maj11-chord' as TechniqueFamily,
    abc: abc(`${tonic}maj11 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.15,
  })),
  ...DOM11_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-dom11-chord`,
    name: `${tonic}11`,
    tonic,
    family: 'dom11-chord' as TechniqueFamily,
    abc: abc(`${tonic}11 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.15,
  })),
  ...MIN11_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-min11-chord`,
    name: `${tonic}m11`,
    tonic,
    family: 'min11-chord' as TechniqueFamily,
    abc: abc(`${tonic}m11 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.15,
  })),
];

/* ─── 36 thirteenth chords (12 maj13 + 12 dom13 + 12 m13) ──────────
 * 13th chords add a 7th tone (a 6th above the octave) on top of the 11th
 * block — the next "skip-one" letter again. So Cmaj13 = [CEGBdfa]4. For
 * B/Bb-rooted chords the stack reaches G6 (g'): Bmaj13 = [Bdfac'e'g']4.
 *
 * Key choice subtlety: m13's 13 is a *major* 6 above the root (the Dorian
 * 6), so the parallel-minor key used for m7/m9/m11 would flatten it to a
 * ♭6 and produce the wrong chord tone. Instead m13 uses the Dorian-
 * relative key — one whole step below the parallel major. E.g. Cm13 →
 * K:Bb gives C Eb G Bb D F A (Dorian on C) with all seven chord tones
 * landing without explicit accidentals.
 */

const MAJ13_KEYS: ChordRow7[] = [
  ['c',  'C',  'C',  '[CEGBdfa]4 |'],
  ['g',  'G',  'G',  "[GBdfac'e']4 |"],
  ['d',  'D',  'D',  '[DFAcegb]4 |'],
  ['a',  'A',  'A',  "[Acegbd'f']4 |"],
  ['e',  'E',  'E',  "[EGBdfac']4 |"],
  ['b',  'B',  'B',  "[Bdfac'e'g']4 |"],
  ['fs', 'F♯', 'F#', "[FAcegbd']4 |"],
  ['f',  'F',  'F',  "[FAcegbd']4 |"],
  ['bb', 'B♭', 'Bb', "[Bdfac'e'g']4 |"],
  ['eb', 'E♭', 'Eb', "[EGBdfac']4 |"],
  ['ab', 'A♭', 'Ab', "[Acegbd'f']4 |"],
  ['db', 'D♭', 'Db', '[DFAcegb]4 |'],
];

const DOM13_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGBdfa]4 |'],
  ['g',  'G',  'C',  "[GBdfac'e']4 |"],
  ['d',  'D',  'G',  '[DFAcegb]4 |'],
  ['a',  'A',  'D',  "[Acegbd'f']4 |"],
  ['e',  'E',  'A',  "[EGBdfac']4 |"],
  ['b',  'B',  'E',  "[Bdfac'e'g']4 |"],
  ['fs', 'F♯', 'B',  "[FAcegbd']4 |"],
  ['f',  'F',  'Bb', "[FAcegbd']4 |"],
  ['bb', 'B♭', 'Eb', "[Bdfac'e'g']4 |"],
  ['eb', 'E♭', 'Ab', "[EGBdfac']4 |"],
  ['ab', 'A♭', 'Db', "[Acegbd'f']4 |"],
  ['db', 'D♭', 'Gb', '[DFAcegb]4 |'],
];

// m13 uses the Dorian-relative key (one whole step below the parallel major)
// so the natural-13 lands without an explicit accidental.
const MIN13_KEYS: ChordRow7[] = [
  ['a',  'A',  'G',  "[Acegbd'f']4 |"],
  ['e',  'E',  'D',  "[EGBdfac']4 |"],
  ['b',  'B',  'A',  "[Bdfac'e'g']4 |"],
  ['fs', 'F♯', 'E',  "[FAcegbd']4 |"],
  ['cs', 'C♯', 'B',  '[CEGBdfa]4 |'],
  ['d',  'D',  'C',  '[DFAcegb]4 |'],
  ['g',  'G',  'F',  "[GBdfac'e']4 |"],
  ['c',  'C',  'Bb', '[CEGBdfa]4 |'],
  ['f',  'F',  'Eb', "[FAcegbd']4 |"],
  ['bb', 'B♭', 'Ab', "[Bdfac'e'g']4 |"],
  ['eb', 'E♭', 'Db', "[EGBdfac']4 |"],
  ['ab', 'A♭', 'Gb', "[Acegbd'f']4 |"],
];

const THIRTEENTHS: Spec[] = [
  ...MAJ13_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-maj13-chord`,
    name: `${tonic}maj13`,
    tonic,
    family: 'maj13-chord' as TechniqueFamily,
    abc: abc(`${tonic}maj13 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.2,
  })),
  ...DOM13_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-dom13-chord`,
    name: `${tonic}13`,
    tonic,
    family: 'dom13-chord' as TechniqueFamily,
    abc: abc(`${tonic}13 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.2,
  })),
  ...MIN13_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-min13-chord`,
    name: `${tonic}m13`,
    tonic,
    family: 'min13-chord' as TechniqueFamily,
    abc: abc(`${tonic}m13 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.2,
  })),
];

/* ─── 72 altered dominants (6 types × 12 keys) ─────────────────────
 *
 * Each altered family takes a dom7/9/11/13 letter sequence and applies one
 * explicit accidental on the altered chord tone. The K: signature is the
 * dom-parent's K (resolution-key major) so the unaltered tones still land
 * without explicit accidentals — only the alteration is marked on the chord.
 *
 * Some flat-key chords (e.g. Eb7♭5 = Eb G Bbb Db, Ab7♭5 = Ab C Ebb Gb,
 * Db7♭5 = Db F Abb Cb) end up with double-flat spellings because the
 * theoretically-correct b5 of a chord whose 5 is already flat is a double
 * flat. We use ABC's `__` prefix for these and accept the busier engraving
 * rather than slipping to enharmonic spellings — the chord theory stays
 * consistent across all 12 keys.
 *
 *   7♭5    1 · 3 · ♭5 · ♭7              (4 tones)
 *   7♯5    1 · 3 · ♯5 · ♭7              (4 tones)
 *   7♭9    1 · 3 · 5 · ♭7 · ♭9          (5 tones)
 *   7♯9    1 · 3 · 5 · ♭7 · ♯9          (5 tones)
 *   7♯11   1 · 3 · 5 · ♭7 · ♯11         (5 tones; the 9 is not implied)
 *   13♭9   1 · 3 · 5 · ♭7 · ♭9 · 11 · 13 (7 tones — dom13 with the 9 altered)
 */

// 7♭5: dom7 with the 5 flatted.
const ALT_7b5_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CE_GB]4 |'],
  ['g',  'G',  'C',  '[GB_df]4 |'],
  ['d',  'D',  'G',  '[DF_Ac]4 |'],
  ['a',  'A',  'D',  '[AC_Eg]4 |'],
  ['e',  'E',  'A',  '[EG_Bd]4 |'],
  ['b',  'B',  'E',  '[Bd=fa]4 |'],
  ['fs', 'F♯', 'B',  '[FA=ce]4 |'],
  ['f',  'F',  'Bb', '[FA_Ce]4 |'],
  ['bb', 'B♭', 'Eb', '[Bd_fa]4 |'],
  ['eb', 'E♭', 'Ab', '[EG__Bd]4 |'],
  ['ab', 'A♭', 'Db', '[AC__Eg]4 |'],
  ['db', 'D♭', 'Gb', '[DF__Ac]4 |'],
];

// 7♯5: dom7 with the 5 sharpened. The ♯5 of a sharp-key 5 needs a
// double-sharp (Bmaj's 5 is F# → ♯5 is Fx). Flat keys come out clean.
const ALT_7s5_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CE^GB]4 |'],
  ['g',  'G',  'C',  '[GB^df]4 |'],
  ['d',  'D',  'G',  '[DF^Ac]4 |'],
  ['a',  'A',  'D',  '[AC^Eg]4 |'],
  ['e',  'E',  'A',  '[EG^Bd]4 |'],
  ['b',  'B',  'E',  '[Bd^^fa]4 |'],
  ['fs', 'F♯', 'B',  '[FA^^ce]4 |'],
  ['f',  'F',  'Bb', '[FA^Ce]4 |'],
  ['bb', 'B♭', 'Eb', '[Bd^fa]4 |'],
  ['eb', 'E♭', 'Ab', '[EG=Bd]4 |'],
  ['ab', 'A♭', 'Db', '[AC=Eg]4 |'],
  ['db', 'D♭', 'Gb', '[DF=Ac]4 |'],
];

// 7♭9: dom7 stack + b9 (no natural 9 implied).
const ALT_7b9_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGB_d]4 |'],
  ['g',  'G',  'C',  '[GBdf_a]4 |'],
  ['d',  'D',  'G',  '[DFAc_e]4 |'],
  ['a',  'A',  'D',  '[ACEg_b]4 |'],
  ['e',  'E',  'A',  "[EGBd=f]4 |"],
  ['b',  'B',  'E',  "[Bdfa=c']4 |"],
  ['fs', 'F♯', 'B',  '[FAce=g]4 |'],
  ['f',  'F',  'Bb', '[FACe_g]4 |'],
  ['bb', 'B♭', 'Eb', "[Bdfa_c']4 |"],
  ['eb', 'E♭', 'Ab', '[EGBd_f]4 |'],
  ['ab', 'A♭', 'Db', '[ACEg__b]4 |'],
  ['db', 'D♭', 'Gb', '[DFAc__e]4 |'],
];

// 7♯9: dom7 stack + #9 (the "Hendrix chord").
const ALT_7s9_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGB^d]4 |'],
  ['g',  'G',  'C',  '[GBdf^a]4 |'],
  ['d',  'D',  'G',  '[DFAc^e]4 |'],
  ['a',  'A',  'D',  '[ACEg^b]4 |'],
  ['e',  'E',  'A',  '[EGBd^f]4 |'],
  ['b',  'B',  'E',  "[Bdfa^c']4 |"],
  ['fs', 'F♯', 'B',  '[FAce^g]4 |'],
  ['f',  'F',  'Bb', '[FACe^g]4 |'],
  ['bb', 'B♭', 'Eb', "[Bdfa=c']4 |"],
  ['eb', 'E♭', 'Ab', '[EGBd=f]4 |'],
  ['ab', 'A♭', 'Db', '[ACEg=b]4 |'],
  ['db', 'D♭', 'Gb', '[DFAc=e]4 |'],
];

// 7♯11: dom7 stack + #11 (Lydian dominant; we omit the 9 to keep the
// chord at five clean tones — adding the 9 is fine but not implied here).
const ALT_7s11_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGB^f]4 |'],
  ['g',  'G',  'C',  "[GBdf^c']4 |"],
  ['d',  'D',  'G',  '[DFAc^g]4 |'],
  ['a',  'A',  'D',  "[ACEg^d']4 |"],
  ['e',  'E',  'A',  '[EGBd^a]4 |'],
  ['b',  'B',  'E',  "[Bdfa^e']4 |"],
  ['fs', 'F♯', 'B',  '[FAce^b]4 |'],
  ['f',  'F',  'Bb', '[FACe=b]4 |'],
  ['bb', 'B♭', 'Eb', "[Bdfa=e']4 |"],
  ['eb', 'E♭', 'Ab', '[EGBd=a]4 |'],
  ['ab', 'A♭', 'Db', "[ACEg=d']4 |"],
  ['db', 'D♭', 'Gb', '[DFAc=g]4 |'],
];

// 13♭9: dom13 stack with the 9 flatted (preserves the 11 and 13).
const ALT_13b9_KEYS: ChordRow7[] = [
  ['c',  'C',  'F',  '[CEGB_dfa]4 |'],
  ['g',  'G',  'C',  "[GBdf_ac'e']4 |"],
  ['d',  'D',  'G',  '[DFAc_egb]4 |'],
  ['a',  'A',  'D',  "[ACEg_bd'f']4 |"],
  ['e',  'E',  'A',  "[EGBd=fac']4 |"],
  ['b',  'B',  'E',  "[Bdfa=c'e'g']4 |"],
  ['fs', 'F♯', 'B',  "[FAce=gbd']4 |"],
  ['f',  'F',  'Bb', "[FACe_gbd']4 |"],
  ['bb', 'B♭', 'Eb', "[Bdfa_c'e'g']4 |"],
  ['eb', 'E♭', 'Ab', "[EGBd_fac']4 |"],
  ['ab', 'A♭', 'Db', "[ACEg__bd'f']4 |"],
  ['db', 'D♭', 'Gb', '[DFAc__egb]4 |'],
];

const ALTERED: Spec[] = [
  ...ALT_7b5_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-7b5-chord`,
    name: `${tonic}7♭5`,
    tonic,
    family: '7b5-chord' as TechniqueFamily,
    abc: abc(`${tonic}7♭5 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.25,
  })),
  ...ALT_7s5_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-7s5-chord`,
    name: `${tonic}7♯5`,
    tonic,
    family: '7s5-chord' as TechniqueFamily,
    abc: abc(`${tonic}7♯5 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.25,
  })),
  ...ALT_7b9_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-7b9-chord`,
    name: `${tonic}7♭9`,
    tonic,
    family: '7b9-chord' as TechniqueFamily,
    abc: abc(`${tonic}7♭9 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.25,
  })),
  ...ALT_7s9_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-7s9-chord`,
    name: `${tonic}7♯9`,
    tonic,
    family: '7s9-chord' as TechniqueFamily,
    abc: abc(`${tonic}7♯9 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.25,
  })),
  ...ALT_7s11_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-7s11-chord`,
    name: `${tonic}7♯11`,
    tonic,
    family: '7s11-chord' as TechniqueFamily,
    abc: abc(`${tonic}7♯11 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.25,
  })),
  ...ALT_13b9_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-13b9-chord`,
    name: `${tonic}13♭9`,
    tonic,
    family: '13b9-chord' as TechniqueFamily,
    abc: abc(`${tonic}13♭9 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.3,
  })),
];

/* ─── 36 more altered: m7♭5 / dim7 / maj7♯11 ──────────────────────
 *
 * Three more jazz-essential alterations:
 *
 *   m7♭5  ø7 / half-diminished   1 · ♭3 · ♭5 · ♭7         (4 tones)
 *   dim7  °7 / fully diminished  1 · ♭3 · ♭5 · ♭♭7        (4 tones)
 *   maj7♯11  lydian major        1 · 3 · 5 · 7 · ♯11      (5 tones)
 *
 * m7♭5 takes the m7 K: (parallel minor) and flats the 5; some flat
 * tonics double-flat (Eb m7♭5 needs Bbb).
 *
 * dim7 is rendered in K:C with every accidental explicit. The bb7
 * spelling preserves the stacked-diminished-thirds theory even where
 * it lands on double-flats (Eb°7 = Eb Gb Bbb Dbb, Ab°7 = Ab Cb Ebb Gbb,
 * Db°7 = Db Fb Abb Cbb). Theoretically correct over enharmonic
 * shortcuts.
 *
 * maj7♯11 takes the maj7 K: (tonic major) and adds an explicit
 * accidental on the #11; the 9 is intentionally omitted to keep this
 * at five clean tones (adding the 9 → "maj9♯11" is a separate chord).
 */

// m7♭5 — m7 stack with the 5th flatted.
const M7B5_KEYS: ChordRow7[] = [
  ['a',  'A',  'Am',  '[AC_Eg]4 |'],
  ['e',  'E',  'Em',  '[EG_Bd]4 |'],
  ['b',  'B',  'Bm',  '[Bd=fa]4 |'],
  ['fs', 'F♯', 'F#m', '[FA=ce]4 |'],
  ['cs', 'C♯', 'C#m', '[CE=GB]4 |'],
  ['d',  'D',  'Dm',  '[DF_Ac]4 |'],
  ['g',  'G',  'Gm',  '[GB_df]4 |'],
  ['c',  'C',  'Cm',  '[CE_GB]4 |'],
  ['f',  'F',  'Fm',  '[FA_Ce]4 |'],
  ['bb', 'B♭', 'Bbm', '[Bd_fa]4 |'],
  ['eb', 'E♭', 'Ebm', '[EG__Bd]4 |'],
  ['ab', 'A♭', 'Abm', '[AC__Eg]4 |'],
];

// dim7 — stacked minor thirds with the diminished-7 spelling (bb7).
// All rendered in K:C with explicit accidentals; some flat tonics land
// on multiple double-flats but the chord-tone theory stays consistent
// across all 12 spellings.
const DIM7_KEYS: ChordRow7[] = [
  ['c',  'C',  'C',  '[C_E_G__B]4 |'],     // C Eb Gb Bbb
  ['g',  'G',  'C',  '[G_B_d_f]4 |'],      // G Bb Db Fb
  ['d',  'D',  'C',  '[DF_A_c]4 |'],       // D F Ab Cb
  ['a',  'A',  'C',  '[AC_E_G]4 |'],       // A C Eb Gb
  ['e',  'E',  'C',  '[EG_B_d]4 |'],       // E G Bb Db
  ['b',  'B',  'C',  '[Bdf_a]4 |'],        // B D F Ab
  ['fs', 'F♯', 'C',  '[^FAc_e]4 |'],       // F# A C Eb
  ['f',  'F',  'C',  '[F_A_c__e]4 |'],     // F Ab Cb Ebb
  ['bb', 'B♭', 'C',  '[_B_d_f__a]4 |'],    // Bb Db Fb Abb
  ['eb', 'E♭', 'C',  '[_E_G__B__d]4 |'],   // Eb Gb Bbb Dbb
  ['ab', 'A♭', 'C',  '[_A_c__e__g]4 |'],   // Ab Cb Ebb Gbb
  ['db', 'D♭', 'C',  "[_D_f__a__c']4 |"],  // Db Fb Abb Cbb
];

// maj7♯11 — maj7 stack with the #11 added (no 9; that's maj9♯11).
const MAJ7S11_KEYS: ChordRow7[] = [
  ['c',  'C',  'C',  '[CEGB^f]4 |'],
  ['g',  'G',  'G',  "[GBdf^c']4 |"],
  ['d',  'D',  'D',  '[DFAc^g]4 |'],
  ['a',  'A',  'A',  "[ACEg^d']4 |"],
  ['e',  'E',  'E',  '[EGBd^a]4 |'],
  ['b',  'B',  'B',  "[Bdfa^e']4 |"],
  ['fs', 'F♯', 'F#', '[FAce^b]4 |'],
  ['f',  'F',  'F',  '[FACe=b]4 |'],
  ['bb', 'B♭', 'Bb', "[Bdfa=e']4 |"],
  ['eb', 'E♭', 'Eb', '[EGBd=a]4 |'],
  ['ab', 'A♭', 'Ab', "[ACEg=d']4 |"],
  ['db', 'D♭', 'Db', '[DFAc=g]4 |'],
];

const HALF_FULL_DIM_LYDIAN: Spec[] = [
  ...M7B5_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-m7b5-chord`,
    name: `${tonic}m7♭5`,
    tonic,
    family: 'm7b5-chord' as TechniqueFamily,
    abc: abc(`${tonic}m7♭5 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.2,
  })),
  ...DIM7_KEYS.map(([idBase, tonic, , notes]) => ({
    id: `${idBase}-dim7-chord`,
    name: `${tonic}°7`,
    tonic,
    family: 'dim7-chord' as TechniqueFamily,
    abc: abc(`${tonic}°7 chord`, 'C', notes),
    // Use the tonic-letter difficulty (not K:C) so the cards' tracking
    // varies with the spelling, not the key signature in the engraving.
    difficulty: (KEY_DIFF[(idBase === 'fs' ? 'F#' : tonic.replace('♭', 'b').replace('♯', '#'))] ?? 0.5) + 0.25,
  })),
  ...MAJ7S11_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-maj7s11-chord`,
    name: `${tonic}maj7♯11`,
    tonic,
    family: 'maj7s11-chord' as TechniqueFamily,
    abc: abc(`${tonic}maj7♯11 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.15,
  })),
];

/* ─── 24 more altered: 7alt + maj7♯5 ──────────────────────────────
 *
 *   7alt      "fully altered" dominant   1 · 3 · ♯5 · ♭7 · ♭9 · ♯9   (6 tones)
 *   maj7♯5    augmented major 7          1 · 3 · ♯5 · 7              (4 tones)
 *
 * 7alt voicing: the ♯9 is spelled as ♭10 (m3 letter at the higher octave)
 * so it doesn't share a letter with the ♭9. All 12 entries are rendered in
 * K:C with every accidental explicit. Sharp keys (B, F♯) need double-sharps
 * for the ♯5 (F##, C##); the worst flat keys (Eb, Ab, Db) use enharmonic-
 * natural spellings for the ♭5/♭9/♭10 positions to avoid stacking triple
 * accidentals.
 *
 * maj7♯5 voicing: takes the maj7 K: (tonic major) and sharps the 5.
 * Bmaj7♯5 / F♯maj7♯5 use double-sharps for theoretical correctness
 * (Bmaj7♯5 = B D♯ Fx A; F♯maj7♯5 = F♯ A♯ Cx E).
 */

const ALT_7ALT_KEYS: ChordRow7[] = [
  ['c',  'C',  'C', '[CE^G_B_d_e]4 |'],         // C E G# Bb Db Eb
  ['g',  'G',  'C', '[GB^df_a_b]4 |'],          // G B D# F Ab Bb
  ['d',  'D',  'C', '[D^F^Ac_e=f]4 |'],         // D F# A# C Eb F
  ['a',  'A',  'C', "[A^c^eg_bc']4 |"],         // A C# E# G Bb C
  ['e',  'E',  'C', '[E^G^Bdf=g]4 |'],          // E G# B# D F G
  ['b',  'B',  'C', "[B^d^^fac'd']4 |"],        // B D# F## A C D (double sharp)
  ['fs', 'F♯', 'C', '[^F^A^^ceg=a]4 |'],        // F# A# C## E G A (double sharp)
  ['f',  'F',  'C', '[FA^c_e_g_a]4 |'],         // F A C# Eb Gb Ab
  ['bb', 'B♭', 'C', "[_Bd^f_a_c'_d']4 |"],      // Bb D F# Ab Cb Db
  ['eb', 'E♭', 'C', '[_EG=B_d_f_g]4 |'],        // Eb G B(=Cb→B) Db Fb Gb
  ['ab', 'A♭', 'C', '[_Ac=e_gab]4 |'],          // Ab C E Gb A B (♭5/♭9/♭10 spelled as naturals)
  ['db', 'D♭', 'C', '[_DF=ab=d=e]4 |'],         // Db F A B D E (♭5/♭7/♭9/♭10 spelled as naturals)
];

const MAJ7S5_KEYS: ChordRow7[] = [
  ['c',  'C',  'C',  '[CE^GB]4 |'],
  ['g',  'G',  'G',  '[GB^df]4 |'],
  ['d',  'D',  'D',  '[DF^Ac]4 |'],
  ['a',  'A',  'A',  '[AC^Eg]4 |'],
  ['e',  'E',  'E',  '[EG^Bd]4 |'],
  ['b',  'B',  'B',  '[Bd^^fa]4 |'],            // F## = G natural
  ['fs', 'F♯', 'F#', '[FA^^ce]4 |'],            // C## = D natural
  ['f',  'F',  'F',  '[FA^Ce]4 |'],
  ['bb', 'B♭', 'Bb', '[Bd^fa]4 |'],
  ['eb', 'E♭', 'Eb', '[EG=Bd]4 |'],             // ♯5 = B natural; K:Eb has Bb
  ['ab', 'A♭', 'Ab', '[AC=Eg]4 |'],             // ♯5 = E natural; K:Ab has Eb
  ['db', 'D♭', 'Db', '[DF=Ac]4 |'],             // ♯5 = A natural; K:Db has Ab
];

const ALT_7ALT_MAJ7S5: Spec[] = [
  ...ALT_7ALT_KEYS.map(([idBase, tonic, , notes]) => ({
    id: `${idBase}-7alt-chord`,
    name: `${tonic}7alt`,
    tonic,
    family: '7alt-chord' as TechniqueFamily,
    abc: abc(`${tonic}7alt chord`, 'C', notes),
    // Use the tonic-letter difficulty (not K:C) so the cards' tracking
    // varies with the spelling complexity, not the K: signature.
    difficulty: (KEY_DIFF[tonic.replace('♭', 'b').replace('♯', '#')] ?? 0.5) + 0.3,
  })),
  ...MAJ7S5_KEYS.map(([idBase, tonic, key, notes]) => ({
    id: `${idBase}-maj7s5-chord`,
    name: `${tonic}maj7♯5`,
    tonic,
    family: 'maj7s5-chord' as TechniqueFamily,
    abc: abc(`${tonic}maj7♯5 chord`, key, notes),
    difficulty: (KEY_DIFF[key] ?? 0.5) + 0.2,
  })),
];

export const DRILLS: Drill[] = [
  ...MAJORS, ...MINORS, ...ARPEGGIOS, ...CHORDS, ...SEVENTHS, ...NINTHS,
  ...ELEVENTHS, ...THIRTEENTHS, ...ALTERED, ...HALF_FULL_DIM_LYDIAN,
  ...ALT_7ALT_MAJ7S5,
].map(build);

/** Daily routine — the user's "warmup order". A mix across families. */
export const DAILY_ROUTINE_IDS: string[] = [
  'c-major',
  'g-major',
  'a-natural-minor',
  'e-natural-minor',
  'c-major-arp',
  'a-minor-arp',
  'c-major-chord',
  'a-minor-chord',
  'c-maj7-chord',
  'd-min9-chord',
  'g-min11-chord',
  'f-maj13-chord',
  'e-7s9-chord',
  'b-m7b5-chord',
  'g-7alt-chord',
];

/** Lookup by id. */
export const DRILL_BY_ID: Map<string, Drill> = new Map(DRILLS.map((d) => [d.id, d]));

/* ─── Filter helpers consumed by DrillsView ───────────────────── */

/** Sub-toggle values within each top tab. */
export const SCALE_SUBTABS = ['major', 'natural', 'harmonic', 'melodic'] as const;
export type ScaleSubTab = (typeof SCALE_SUBTABS)[number];

export const QUALITY_SUBTABS = ['major', 'minor'] as const;
export type QualitySubTab = (typeof QUALITY_SUBTABS)[number];

export const SCALE_FAMILY_BY_SUBTAB: Record<ScaleSubTab, TechniqueFamily> = {
  major:    'major',
  natural:  'natural-minor',
  harmonic: 'harmonic-minor',
  melodic:  'melodic-minor',
};

export const ARP_FAMILY_BY_QUALITY: Record<QualitySubTab, TechniqueFamily> = {
  major: 'major-arpeggio',
  minor: 'minor-arpeggio',
};

export const CHORD_FAMILY_BY_QUALITY: Record<QualitySubTab, TechniqueFamily> = {
  major: 'major-chord',
  minor: 'minor-chord',
};

/* ─── Chord type taxonomy (grows as we add 9ths / 11ths / 13ths / altered) ─
 *
 * Each "chord type" is one selectable pill in the Chords sub-toggle.
 * Types are grouped into "categories" rendered as their own labelled row, so
 * the next layer of extensions slots in cleanly:
 *
 *   triads  → Major · Minor
 *   7ths    → Maj7  · Dom7  · Min7
 *   9ths    → (next)
 *   11ths   → (next)
 *   13ths   → (next)
 *   altered → (next)
 */

export const CHORD_TYPES = [
  'major',
  'minor',
  'maj7',
  'dom7',
  'min7',
  'maj9',
  'dom9',
  'min9',
  'maj11',
  'dom11',
  'min11',
  'maj13',
  'dom13',
  'min13',
  '7b5',
  '7s5',
  '7b9',
  '7s9',
  '7s11',
  '13b9',
  'm7b5',
  'dim7',
  'maj7s11',
  '7alt',
  'maj7s5',
] as const;
export type ChordType = (typeof CHORD_TYPES)[number];

export interface ChordTypeMeta {
  type: ChordType;
  /** Pill label shown in the sub-toggle. */
  label: string;
  /** Group the pill is rendered in. */
  category: 'triads' | 'sevenths' | 'ninths' | 'elevenths' | 'thirteenths' | 'altered';
  /** The TechniqueFamily this type maps to. */
  family: TechniqueFamily;
}

export const CHORD_TYPE_META: Record<ChordType, ChordTypeMeta> = {
  major: { type: 'major', label: 'Major', category: 'triads',      family: 'major-chord' },
  minor: { type: 'minor', label: 'Minor', category: 'triads',      family: 'minor-chord' },
  maj7:  { type: 'maj7',  label: 'Maj7',  category: 'sevenths',    family: 'maj7-chord' },
  dom7:  { type: 'dom7',  label: 'Dom7',  category: 'sevenths',    family: 'dom7-chord' },
  min7:  { type: 'min7',  label: 'Min7',  category: 'sevenths',    family: 'min7-chord' },
  maj9:  { type: 'maj9',  label: 'Maj9',  category: 'ninths',      family: 'maj9-chord' },
  dom9:  { type: 'dom9',  label: 'Dom9',  category: 'ninths',      family: 'dom9-chord' },
  min9:  { type: 'min9',  label: 'Min9',  category: 'ninths',      family: 'min9-chord' },
  maj11: { type: 'maj11', label: 'Maj11', category: 'elevenths',   family: 'maj11-chord' },
  dom11: { type: 'dom11', label: 'Dom11', category: 'elevenths',   family: 'dom11-chord' },
  min11: { type: 'min11', label: 'Min11', category: 'elevenths',   family: 'min11-chord' },
  maj13: { type: 'maj13', label: 'Maj13', category: 'thirteenths', family: 'maj13-chord' },
  dom13: { type: 'dom13', label: 'Dom13', category: 'thirteenths', family: 'dom13-chord' },
  min13: { type: 'min13', label: 'Min13', category: 'thirteenths', family: 'min13-chord' },
  '7b5':     { type: '7b5',     label: '7♭5',      category: 'altered', family: '7b5-chord' },
  '7s5':     { type: '7s5',     label: '7♯5',      category: 'altered', family: '7s5-chord' },
  '7b9':     { type: '7b9',     label: '7♭9',      category: 'altered', family: '7b9-chord' },
  '7s9':     { type: '7s9',     label: '7♯9',      category: 'altered', family: '7s9-chord' },
  '7s11':    { type: '7s11',    label: '7♯11',     category: 'altered', family: '7s11-chord' },
  '13b9':    { type: '13b9',    label: '13♭9',     category: 'altered', family: '13b9-chord' },
  'm7b5':    { type: 'm7b5',    label: 'm7♭5',     category: 'altered', family: 'm7b5-chord' },
  'dim7':    { type: 'dim7',    label: '°7',       category: 'altered', family: 'dim7-chord' },
  'maj7s11': { type: 'maj7s11', label: 'maj7♯11',  category: 'altered', family: 'maj7s11-chord' },
  '7alt':    { type: '7alt',    label: '7alt',     category: 'altered', family: '7alt-chord' },
  'maj7s5':  { type: 'maj7s5',  label: 'maj7♯5',   category: 'altered', family: 'maj7s5-chord' },
};

export const CHORD_CATEGORIES = [
  { id: 'triads',      label: 'Triads' },
  { id: 'sevenths',    label: '7ths' },
  { id: 'ninths',      label: '9ths' },
  { id: 'elevenths',   label: '11ths' },
  { id: 'thirteenths', label: '13ths' },
  { id: 'altered',     label: 'Altered' },
] as const;
export type ChordCategory = (typeof CHORD_CATEGORIES)[number]['id'];

/* ─── Back-compat re-exports (renamed in this PR; kept for any external refs) ─ */
export const SCALES = DRILLS;
export const SCALE_BY_ID = DRILL_BY_ID;
