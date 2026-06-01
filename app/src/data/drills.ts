import type { Drill, TechniqueFamily } from './schemas';
import {
  chordDrillCatalog,
  type ChordDrillEntry,
  type ChordTypeId,
  MAJOR_ROOTS,
} from './chord-catalog';
import { chordKey, displayName, toAbc } from './chord-identity';
import { scaleAbc } from './scales/engraving';
import { JAPANESE_SCALES } from './scales/world';

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

/* ─── 300 block chords, generated from ChordIdentity ───────────────
 * The chord engravings are no longer hand-typed. Each chord drill is a small
 * identity (root + quality + 7th + extensions + alterations — see
 * chord-catalog.ts), and `toAbc` renders the ABC block at module load, picking
 * the key signature and deriving accidentals; `displayName` gives the chord
 * symbol. Adding a chord type is now a catalog entry — no ABC strings, no
 * switch arms, no enum churn.
 *
 * Difficulty keeps the original tuning: the circle-of-fifths distance of the
 * engraving key, plus a per-type complexity bump. (°7 and 7alt engrave in
 * K:C, so their difficulty keys off the tonic letter instead, as before.)
 */
const CHORD_DIFFICULTY_BUMP: Record<ChordTypeId, number> = {
  major: 0, minor: 0,
  maj7: 0.05, dom7: 0.05, min7: 0.05,
  maj9: 0.1, dom9: 0.1, min9: 0.1,
  maj11: 0.15, dom11: 0.15, min11: 0.15,
  maj13: 0.2, dom13: 0.2, min13: 0.2,
  '7b5': 0.25, '7s5': 0.25, '7b9': 0.25, '7s9': 0.25, '7s11': 0.25, '13b9': 0.3,
  m7b5: 0.2, dim7: 0.25, maj7s11: 0.15,
  '7alt': 0.3, maj7s5: 0.2,
};

/** °7 and 7alt engrave in K:C, so their difficulty keys off the tonic letter. */
const TONIC_KEYED_DIFFICULTY = new Set<ChordTypeId>(['dim7', '7alt']);

function chordSpec({ id, type, tonic, identity }: ChordDrillEntry): Spec {
  const isTriad = type === 'major' || type === 'minor';
  const name = isTriad ? `${tonic} ${type} chord` : displayName(identity);
  const title = isTriad ? name : `${name} chord`;
  const diffKey = TONIC_KEYED_DIFFICULTY.has(type)
    ? tonic.replace('♭', 'b').replace('♯', '#')
    : chordKey(identity);
  return {
    id,
    name,
    tonic,
    family: `${type}-chord` as TechniqueFamily,
    abc: toAbc(identity, title),
    difficulty: (KEY_DIFF[diffKey] ?? 0.5) + CHORD_DIFFICULTY_BUMP[type],
  };
}

const CHORDS: Spec[] = chordDrillCatalog().map(chordSpec);

/* ─── 60 world-music scales (5 Japanese pentatonics × 12 keys) ──────────
 * Generated from interval sets (scales/world.ts) — `scaleAbc` renders the
 * ascending engraving, no hand-typed strings. The microtonal traditions are a
 * later phase. */
const WORLD_SCALES: Spec[] = JAPANESE_SCALES.flatMap((scale) =>
  MAJOR_ROOTS.map(({ idBase, tonic, root }) => {
    const name = `${tonic} ${scale.name}`;
    const majorKey = root.letter + (root.accidental === 'sharp' ? '#' : root.accidental === 'flat' ? 'b' : '');
    return {
      id: `${idBase}-${scale.id}`,
      name,
      tonic,
      family: scale.id as TechniqueFamily,
      abc: scaleAbc(scale, root.letter, root.accidental, name),
      difficulty: (KEY_DIFF[majorKey] ?? 0.5) + 0.1,
    };
  }),
);

export const DRILLS: Drill[] = [
  ...MAJORS, ...MINORS, ...ARPEGGIOS, ...CHORDS, ...WORLD_SCALES,
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
export const SCALE_SUBTABS = [
  'major', 'natural', 'harmonic', 'melodic',
  'hirajoshi', 'in-sen', 'yo', 'iwato', 'kumoi',
] as const;
export type ScaleSubTab = (typeof SCALE_SUBTABS)[number];

export const QUALITY_SUBTABS = ['major', 'minor'] as const;
export type QualitySubTab = (typeof QUALITY_SUBTABS)[number];

export const SCALE_FAMILY_BY_SUBTAB: Record<ScaleSubTab, TechniqueFamily> = {
  major:    'major',
  natural:  'natural-minor',
  harmonic: 'harmonic-minor',
  melodic:  'melodic-minor',
  hirajoshi: 'hirajoshi',
  'in-sen':  'in-sen',
  yo:        'yo',
  iwato:     'iwato',
  kumoi:     'kumoi',
};

/** Scales are grouped into labelled rows (Western · Japanese …). */
export const SCALE_CATEGORIES = [
  { id: 'western',  label: 'Western' },
  { id: 'japanese', label: 'Japanese' },
] as const;
export type ScaleCategory = (typeof SCALE_CATEGORIES)[number]['id'];

export const SCALE_SUBTAB_CATEGORY: Record<ScaleSubTab, ScaleCategory> = {
  major: 'western', natural: 'western', harmonic: 'western', melodic: 'western',
  hirajoshi: 'japanese', 'in-sen': 'japanese', yo: 'japanese', iwato: 'japanese', kumoi: 'japanese',
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
