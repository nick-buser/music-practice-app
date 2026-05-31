/**
 * Chord identity model + pure derivation.
 *
 * The premise (see the refactor plan): a chord is *data* — a root, a triad
 * quality, a 7th, a set of extensions, and a few alterations — and every
 * engraving artefact (the ABC bracket, the chord symbol, the degree subtitle,
 * the MIDI for playback) is *derived* from that data. Today the drills library
 * ships ~300 hand-typed ABC strings across 25 chord families; this module is
 * the machine that regenerates them from a single shape.
 *
 * Nothing here is wired into `drills.ts` yet — this is the standalone model and
 * its derivation functions, so we can prove (in chord-identity.test.ts) that
 * `toAbc` reproduces the existing engravings before any migration.
 *
 * The `ChordIdentity` object is plain JSON (no classes, no enums-as-objects) so
 * it can live unmodified in a DB column.
 */

/* ─── The identity shape ──────────────────────────────────────────── */

export type RootLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type RootAccidental = 'natural' | 'sharp' | 'flat';

export interface Root {
  letter: RootLetter;
  accidental: RootAccidental;
}

/** The triad under the chord — what the 1/3/5 (or 1/2/4) are. */
export type TriadQuality = 'major' | 'minor' | 'dim' | 'aug' | 'sus2' | 'sus4';

/**
 * The seventh's quality, when a seventh is present. This is the one place the
 * shape departs from the original sketch (`extensions: Array<6|7|9|11|13>`): a
 * bare `7` can't tell a major 7th (Cmaj7) from a dominant ♭7 (C7) from a
 * diminished ♭♭7 (C°7), and that distinction also picks the key signature, so
 * the 7th carries its own quality.
 *   maj7 → major 7th (11 semitones)
 *   min7 → minor 7th (10)  — the "dominant"/minor-seventh sound
 *   dim7 → diminished 7th (9)
 */
export type SeventhType = 'maj7' | 'min7' | 'dim7';

/** Upper structure present beyond the triad. The 7 is qualified by `seventh`. */
export type Extension = 6 | 7 | 9 | 11 | 13;

export type AlterationDegree = 5 | 9 | 11 | 13;
export type AlterationChange = '#' | 'b';
export interface Alteration {
  degree: AlterationDegree;
  change: AlterationChange;
}

export type VoicingType = 'block' | 'drop2' | 'drop3';
export interface Voicing {
  type: VoicingType;
  /** 0 = root position, 1/2/3 = inversions (used in a later PR). */
  inversion: 0 | 1 | 2 | 3;
  /** ABC octave the root sits in (4 = the C4–B4 band, i.e. plain uppercase). */
  rootOctave: number;
  /** Block triads double the root an octave up (1·3·5·8). */
  doubleRoot?: boolean;
}

export interface ChordIdentity {
  root: Root;
  quality: TriadQuality;
  /** Present iff the chord has a 7th (and therefore any 9/11/13 above it). */
  seventh?: SeventhType;
  /** Which upper degrees are present, e.g. [7, 9, 11, 13] for a 13th chord. */
  extensions: Extension[];
  alterations: Alteration[];
  voicing: Voicing;
}

/** A spelled, octave-placed chord tone. */
export interface Pitch {
  letter: RootLetter;
  /** -2..+2 (♭♭ … ♯♯) relative to the natural letter. */
  alter: number;
  /** ABC octave (4 = uppercase C4–B4). */
  octave: number;
  /** MIDI note number (C4 = 60). */
  midi: number;
  /** Scale degree this tone realises (1,2,3,4,5,7,9,11,13; 8 = octave root). */
  degree: number;
  /** Interval above the root in semitones — the functional size of the degree. */
  semitones: number;
}

/* ─── Note arithmetic ─────────────────────────────────────────────── */

const LETTERS: RootLetter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC: Record<RootLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ROOT_ALTER: Record<RootAccidental, number> = { natural: 0, sharp: 1, flat: -1 };

function rootPc(root: Root): number {
  return NATURAL_PC[root.letter] + ROOT_ALTER[root.accidental];
}

/** Wrap an alteration into the playable ±2 (double-flat … double-sharp) range. */
function normalizeAlter(raw: number): number {
  let a = ((raw % 12) + 12) % 12;
  if (a > 6) a -= 12;
  return a;
}

/* ─── Tone derivation ─────────────────────────────────────────────── */

interface RawTone {
  /** Diatonic steps above the root letter (0=root, 2=3rd, 4=5th, 6=7th, …). */
  step: number;
  /** Semitones above the root. */
  semitones: number;
  /** Scale degree label. */
  degree: number;
}

/** Third (or 2nd / 4th for sus) for each triad quality: [step, semitones, degree]. */
const TRIAD_THIRD: Record<TriadQuality, [number, number, number]> = {
  major: [2, 4, 3],
  aug: [2, 4, 3],
  minor: [2, 3, 3],
  dim: [2, 3, 3],
  sus2: [1, 2, 2],
  sus4: [3, 5, 4],
};

/** Base (unaltered) fifth in semitones for each triad quality. */
const TRIAD_FIFTH_SEMIS: Record<TriadQuality, number> = {
  major: 7, minor: 7, sus2: 7, sus4: 7, dim: 6, aug: 8,
};

const SEVENTH_SEMIS: Record<SeventhType, number> = { maj7: 11, min7: 10, dim7: 9 };

function alterationFor(c: ChordIdentity, degree: AlterationDegree, change: AlterationChange): boolean {
  return c.alterations.some((a) => a.degree === degree && a.change === change);
}

/** Ordered, spelled chord tones — the heart of every other derivation. */
export function chordTones(c: ChordIdentity): Pitch[] {
  const rawTones: RawTone[] = [];

  // 1. Root.
  rawTones.push({ step: 0, semitones: 0, degree: 1 });

  // 2. Third (or sus 2nd/4th).
  const [thirdStep, thirdSemi, thirdDeg] = TRIAD_THIRD[c.quality];
  rawTones.push({ step: thirdStep, semitones: thirdSemi, degree: thirdDeg });

  // 3. Fifth, with any explicit 5-alteration applied (7♭5 / 7♯5 / maj7♯5).
  let fifthSemi = TRIAD_FIFTH_SEMIS[c.quality];
  if (alterationFor(c, 5, 'b')) fifthSemi -= 1;
  if (alterationFor(c, 5, '#')) fifthSemi += 1;
  rawTones.push({ step: 4, semitones: fifthSemi, degree: 5 });

  // 4. Seventh.
  if (c.seventh) {
    rawTones.push({ step: 6, semitones: SEVENTH_SEMIS[c.seventh], degree: 7 });
  }

  // 5. Ninth.
  if (c.extensions.includes(9)) {
    const flat9 = alterationFor(c, 9, 'b');
    const sharp9 = alterationFor(c, 9, '#');
    if (flat9) rawTones.push({ step: 8, semitones: 13, degree: 9 });
    if (sharp9) {
      // When both ♭9 and ♯9 are present (the "alt" dominant), the ♯9 is spelled
      // as a ♭10 — the minor-3rd letter an octave up — so it doesn't collide
      // with the ♭9's letter. On its own it stays a ♯9 (the 9th letter).
      rawTones.push({ step: flat9 ? 9 : 8, semitones: 15, degree: 9 });
    }
    if (!flat9 && !sharp9) rawTones.push({ step: 8, semitones: 14, degree: 9 });
  }

  // 6. Eleventh.
  if (c.extensions.includes(11)) {
    const semi = alterationFor(c, 11, '#') ? 18 : 17;
    rawTones.push({ step: 10, semitones: semi, degree: 11 });
  }

  // 7. Thirteenth.
  if (c.extensions.includes(13)) {
    const semi = alterationFor(c, 13, 'b') ? 20 : 21;
    rawTones.push({ step: 12, semitones: semi, degree: 13 });
  }

  // 8. Spell + place each core tone (close root-position stack, ascending).
  const rootIdx = LETTERS.indexOf(c.root.letter);
  const rootMidi = 12 * (c.voicing.rootOctave + 1) + rootPc(c.root);
  const core: Pitch[] = rawTones.map(({ step, semitones, degree }) => {
    const letter = LETTERS[(rootIdx + step) % 7];
    const targetMidi = rootMidi + semitones;
    const alter = normalizeAlter((rootPc(c.root) + semitones) - NATURAL_PC[letter]);
    // The octave is whatever places this spelled letter at the target pitch.
    const octave = Math.round((targetMidi - NATURAL_PC[letter] - alter) / 12) - 1;
    return { letter, alter, octave, midi: targetMidi, degree, semitones };
  });

  return voiceChord(core, c.voicing);
}

const shiftOctave = (p: Pitch, delta: number): Pitch => ({
  ...p,
  octave: p.octave + delta,
  midi: p.midi + 12 * delta,
});

const byMidi = (a: Pitch, b: Pitch): number => a.midi - b.midi;

/**
 * Re-voice the close root-position `core` tones:
 *  - block + root position optionally doubles the root an octave up (1·3·5·8);
 *  - inversion k lifts the lowest k tones up an octave (the k-th tone to the bass);
 *  - drop2 / drop3 lower the 2nd / 3rd voice from the top by an octave.
 * Returns the result sorted low → high.
 */
function voiceChord(core: Pitch[], voicing: Voicing): Pitch[] {
  if (voicing.inversion === 0 && voicing.type === 'block') {
    return voicing.doubleRoot
      ? [...core, { ...shiftOctave(core[0], 1), degree: 8, semitones: 12 }]
      : core;
  }

  const tones = core.map((p) => ({ ...p })).sort(byMidi);

  // Inversion: lift the lowest `inversion` tones up an octave.
  const inv = Math.min(voicing.inversion, tones.length - 1);
  for (let i = 0; i < inv; i++) tones[i] = shiftOctave(tones[i], 1);
  tones.sort(byMidi);

  // Drop voicing: lower the n-th voice from the top by an octave.
  const fromTop = voicing.type === 'drop2' ? 2 : voicing.type === 'drop3' ? 3 : 0;
  if (fromTop && tones.length >= fromTop) {
    const idx = tones.length - fromTop;
    tones[idx] = shiftOctave(tones[idx], -1);
    tones.sort(byMidi);
  }
  return tones;
}

/** The number of distinct chord tones (no octave double) — what inversions act on. */
export function coreToneCount(c: ChordIdentity): number {
  return chordTones({
    ...c,
    voicing: { ...c.voicing, type: 'block', inversion: 0, doubleRoot: false },
  }).length;
}

/** MIDI note numbers for playback (C4 = 60). */
export function toMidi(c: ChordIdentity): number[] {
  return chordTones(c).map((p) => p.midi);
}

/* ─── Key-signature selection ─────────────────────────────────────── */

const ORDER_OF_SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const ORDER_OF_FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Net accidentals for each major key (positive = sharps, negative = flats). */
const MAJOR_KEY_ACCIDENTALS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
};

/** A minor key's signature is its relative major's. */
const RELATIVE_MAJOR: Record<string, string> = {
  Am: 'C', Em: 'G', Bm: 'D', 'F#m': 'A', 'C#m': 'E',
  Dm: 'F', Gm: 'Bb', Cm: 'Eb', Fm: 'Ab', Bbm: 'Db', Ebm: 'Gb', Abm: 'Cb',
};

/** The ABC name of the root spelled as a major key (e.g. F♯→"F#", D♭→"Db"). */
function majorKeyName(root: Root): string {
  const suffix = root.accidental === 'sharp' ? '#' : root.accidental === 'flat' ? 'b' : '';
  return root.letter + suffix;
}

/** Major key a perfect 4th up — the "resolution key" where a ♭7 is diatonic. */
const FOURTH_UP: Record<string, string> = {
  C: 'F', G: 'C', D: 'G', A: 'D', E: 'A', B: 'E', 'F#': 'B',
  F: 'Bb', Bb: 'Eb', Eb: 'Ab', Ab: 'Db', Db: 'Gb',
};

/** Major key a whole step down — the Dorian-relative, where a natural 13 lands clean. */
const SECOND_DOWN: Record<string, string> = {
  A: 'G', E: 'D', B: 'A', 'F#': 'E', 'C#': 'B', D: 'C',
  G: 'F', C: 'Bb', F: 'Eb', Bb: 'Ab', Eb: 'Db', Ab: 'Gb',
};

function isDominant(c: ChordIdentity): boolean {
  return c.quality === 'major' && c.seventh === 'min7';
}

function isAltered(c: ChordIdentity): boolean {
  // The "alt" dominant carries both a ♭9 and a ♯9.
  return alterationFor(c, 9, 'b') && alterationFor(c, 9, '#');
}

/**
 * The key signature `toAbc` engraves under, chosen so the chord's diatonic
 * tones land without explicit accidentals:
 *   major / major-7th family → the tonic major
 *   minor / half-diminished  → the parallel minor
 *   minor 13                 → the Dorian-relative major (keeps a natural 13)
 *   dominants                → the resolution-key major (a 4th up)
 *   diminished 7 & altered   → C (every accidental spelled explicitly)
 */
export function chordKey(c: ChordIdentity): string {
  const name = majorKeyName(c.root);

  if (c.seventh === 'dim7' || isAltered(c)) return 'C';

  if (isDominant(c)) return FOURTH_UP[name];

  if (c.quality === 'minor' || c.quality === 'dim') {
    if (c.extensions.includes(13)) return SECOND_DOWN[name];
    return name + 'm';
  }

  // Major triad and the maj7 family.
  return name;
}

/** letter → signed alteration implied by a key signature. */
function keySignatureMap(key: string): Record<RootLetter, number> {
  const major = key.endsWith('m') ? RELATIVE_MAJOR[key] : key;
  const n = MAJOR_KEY_ACCIDENTALS[major];
  const map: Record<RootLetter, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (n > 0) for (let i = 0; i < n; i++) map[ORDER_OF_SHARPS[i] as RootLetter] = 1;
  else if (n < 0) for (let i = 0; i < -n; i++) map[ORDER_OF_FLATS[i] as RootLetter] = -1;
  return map;
}

/* ─── ABC engraving ───────────────────────────────────────────────── */

const ALTER_TO_ABC: Record<number, string> = {
  [-2]: '__', [-1]: '_', 0: '=', 1: '^', 2: '^^',
};

function abcOctaveMarks(octave: number): { lower: boolean; marks: string } {
  if (octave >= 5) return { lower: true, marks: "'".repeat(octave - 5) };
  return { lower: false, marks: ','.repeat(4 - octave) };
}

/** Render the chord as a single ABC measure, e.g. "[CEGB]4 |". */
export function toAbcMeasure(c: ChordIdentity): string {
  const tones = chordTones(c);
  const sig = keySignatureMap(chordKey(c));
  // Track the accidental in effect per letter within the chord so a later tone
  // sharing a letter with an earlier-altered one is disambiguated (e.g. ♯F then
  // a natural f gets an explicit `=`). This is the courtesy-accidental rule.
  const effective: Record<RootLetter, number> = { ...sig };

  const body = tones
    .map((t) => {
      let prefix = '';
      if (t.alter !== effective[t.letter]) {
        prefix = ALTER_TO_ABC[t.alter];
        effective[t.letter] = t.alter;
      }
      const { lower, marks } = abcOctaveMarks(t.octave);
      return prefix + (lower ? t.letter.toLowerCase() : t.letter) + marks;
    })
    .join('');

  return `[${body}]4 |`;
}

/** A full Verovio-ready ABC document for the chord (header + the block measure). */
export function toAbc(c: ChordIdentity, title = displayName(c)): string {
  return `X:1\nT:${title}\nM:4/4\nL:1/4\nK:${chordKey(c)}\n${toAbcMeasure(c)}`;
}

/* ─── Display name (jazz chord symbol) ────────────────────────────── */

function rootSymbol(root: Root): string {
  const acc = root.accidental === 'sharp' ? '♯' : root.accidental === 'flat' ? '♭' : '';
  return root.letter + acc;
}

const ALTER_SYMBOL: Record<AlterationChange, string> = { '#': '♯', b: '♭' };

/**
 * The headline extension for naming: the tallest extension that's present and
 * *unaltered*. So 13♭9 keeps its "13" (the 11 & 13 are natural), but 7♭9 stays
 * a "7" (its only extension, the 9, is altered).
 */
function headlineExtension(c: ChordIdentity): number {
  let number = 7;
  for (const deg of [9, 11, 13] as const) {
    if (c.extensions.includes(deg) && !alterationFor(c, deg, '#') && !alterationFor(c, deg, 'b')) {
      number = deg;
    }
  }
  return number;
}

/**
 * The chord symbol: "Cmaj7", "C7", "Am7", "C7♯11", "C°7", "C7alt"… For inverted
 * voicings it appends a slash bass (e.g. "G/B").
 */
export function displayName(c: ChordIdentity): string {
  const root = rootSymbol(c.root);
  let symbol: string;

  if (c.seventh === 'dim7') {
    symbol = root + '°7';
  } else if (c.quality === 'dim' && c.seventh === 'min7') {
    symbol = root + 'm7♭5';
  } else if (isAltered(c)) {
    symbol = root + '7alt';
  } else if (!c.seventh) {
    // Triad.
    const q = c.quality === 'minor' ? 'm'
      : c.quality === 'aug' ? '+'
      : c.quality === 'sus2' ? 'sus2'
      : c.quality === 'sus4' ? 'sus4'
      : '';
    symbol = root + q;
  } else {
    // A seventh chord, possibly extended/altered.
    const family = c.quality === 'minor' ? 'm' : c.seventh === 'maj7' ? 'maj' : '';
    const suffix = c.alterations
      .slice()
      .sort((a, b) => a.degree - b.degree)
      .map((a) => ALTER_SYMBOL[a.change] + a.degree)
      .join('');
    symbol = root + family + headlineExtension(c) + suffix;
  }

  // A slash bass whenever the lowest sounding tone isn't the root — covers
  // both inversions and drop voicings (which sink an upper voice below the root).
  const bass = chordTones(c)[0];
  if (bass && bass.degree !== 1) {
    const glyph = bass.alter > 0 ? '♯'.repeat(bass.alter) : bass.alter < 0 ? '♭'.repeat(-bass.alter) : '';
    symbol += '/' + bass.letter + glyph;
  }
  return symbol;
}

/* ─── Subtitle line (spoken degrees) ──────────────────────────────── */

function degreeLabel(p: Pitch): string {
  // Labelled by the interval (functional size), not the spelling — the alt
  // dominant's ♯9 is spelled as a ♭10 but is still a ♯9.
  switch (p.degree) {
    case 1: return '1';
    case 2: return '2';
    case 3: return p.semitones === 3 ? '♭3' : '3';
    case 4: return '4';
    case 5: return p.semitones === 6 ? '♭5' : p.semitones === 8 ? '♯5' : '5';
    case 7: return p.semitones === 9 ? '♭♭7' : p.semitones === 10 ? '♭7' : '7';
    case 9: return p.semitones === 13 ? '♭9' : p.semitones === 15 ? '♯9' : '9';
    case 11: return p.semitones === 18 ? '♯11' : '11';
    case 13: return p.semitones === 20 ? '♭13' : '13';
    default: return '';
  }
}

/**
 * The spoken name of the chord's quality — the idiomatic phrase a player would
 * say: "major 7", "altered dominant", "half-diminished 7", "lydian major"…
 */
function qualityPhrase(c: ChordIdentity): string {
  if (!c.seventh) return c.quality === 'minor' ? 'minor triad' : 'major triad';
  if (c.seventh === 'dim7') return 'fully diminished 7';
  if (c.quality === 'dim') return 'half-diminished 7'; // dim triad + ♭7
  if (isAltered(c)) return 'fully altered dominant';

  const sharp11 = alterationFor(c, 11, '#');
  const altered5 = alterationFor(c, 5, '#') || alterationFor(c, 5, 'b');
  const altered9 = alterationFor(c, 9, '#') || alterationFor(c, 9, 'b');

  if (c.seventh === 'maj7') {
    if (sharp11) return 'lydian major';
    if (altered5) return 'augmented major 7';
    return `major ${headlineExtension(c)}`;
  }
  if (c.quality === 'minor') return `minor ${headlineExtension(c)}`;

  // Dominant family (major triad + ♭7).
  if (sharp11) return 'lydian dominant';
  if (alterationFor(c, 9, 'b') && c.extensions.includes(13)) return 'dominant 13 ♭9';
  if (altered5 || altered9) return 'altered dominant';
  return `dominant ${headlineExtension(c)}`;
}

/** The voicing descriptor appended to a subtitle: "1st inversion", "drop 2"… */
function voicingLabel(v: Voicing): string {
  if (v.type === 'drop2') return 'drop 2';
  if (v.type === 'drop3') return 'drop 3';
  if (v.inversion === 1) return '1st inversion';
  if (v.inversion === 2) return '2nd inversion';
  if (v.inversion === 3) return '3rd inversion';
  return '';
}

/**
 * The italic descriptor beneath a drill: "major 7 · 1 · 3 · 5 · 7",
 * "altered dominant · 1 · 3 · ♭5 · ♭7", "major 7 · 1st inversion · 1 · 3 · 5 · 7".
 * One derivation in place of the chord arms of both DrillsView's `subtitleFor`
 * and subject.ts's byline switch.
 */
export function subtitleLine(c: ChordIdentity): string {
  // The degree formula always reads in canonical 1·3·5·7 order — it describes
  // the chord, not the voicing — so derive it from the close root-position
  // tones, and note the actual voicing separately.
  const formula = chordTones({
    ...c,
    voicing: { ...c.voicing, type: 'block', inversion: 0, doubleRoot: false },
  })
    .map(degreeLabel)
    .join(' · ');
  const voicing = voicingLabel(c.voicing);
  return `${qualityPhrase(c)}${voicing ? ' · ' + voicing : ''} · ${formula}`;
}
