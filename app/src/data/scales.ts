import type { Scale, TechniqueFamily } from './schemas';

/**
 * The technique library: 12 major scales, 36 minor scales (12 keys × natural /
 * harmonic / melodic-ascending), and 24 arpeggios (12 major + 12 minor).
 *
 * All engravings are minimal Verovio-ready ABC. The notes follow the key
 * signature for accidentals, so we only write `^` or `=` when a variant
 * deliberately raises or naturals a scale degree (harmonic minor's #7,
 * melodic-ascending's #6 / #7).
 *
 * Tracking state (comfort / lastTouched / bpmCurrent / reps) is deterministic
 * mock data seeded off each scale's id, so the cards have plausible variation
 * without anyone having to maintain a 72-row table.
 */

const abc = (title: string, key: string, notes: string): string =>
  `X:1\nT:${title}\nM:4/4\nL:1/4\nK:${key}\n${notes}`;

/* ─── Tracking-state seed ─────────────────────────────────
 * A small deterministic RNG keyed off the scale id gives each card a
 * plausible comfort / tempo / last-touched without us hand-tuning 72 rows.
 * Comfort is biased by difficulty band (how far a key is from C).
 */
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
  // difficulty: 0 = easiest (C/G/F/Am), 1 = hardest (F#/Db/Abm). Comfort range
  // tightens with difficulty so a glance reads the right colour.
  const r = rng(hash(id));
  const base = 0.95 - difficulty * 0.7;
  const comfort = Math.max(0.05, Math.min(0.98, base + (r() - 0.5) * 0.3));
  const bpmTarget = comfort > 0.75 ? 140 : 132;
  const bpmCurrent = Math.round(
    bpmTarget * Math.min(1, comfort + 0.05 + r() * 0.05),
  );
  const reps = Math.round(60 + comfort * 280 + r() * 40);
  // Last touched within the past month, never in the future.
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
  difficulty: number; // 0–1, drives tracking-state band
}

function build(s: Spec): Scale {
  return { ...s, ...trackingFor(s.id, s.difficulty) };
}

/* ─── Difficulty bands ────────────────────────────────────
 * Sequenced across the circle of fifths, closest-to-no-accidentals first.
 */
const KEY_DIFF: Record<string, number> = {
  C: 0.0, G: 0.05, D: 0.1, A: 0.2, E: 0.35, B: 0.55, 'F#': 0.85,
  F: 0.1, Bb: 0.2, Eb: 0.3, Ab: 0.55, Db: 0.8,
  // Minor tonics use the same scale (difficulty by signature count, not parallel major)
  Am: 0.0, Em: 0.1, Bm: 0.2, 'F#m': 0.35, 'C#m': 0.55, 'G#m': 0.85,
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

/* ─── 12 minor tonics × 3 variants = 36 minor scales ─────
 * Each tuple: [tonic letter for ids, display tonic, K:<sig>, natural-notes,
 * harmonic-notes (#7), melodic-ascending-notes (#6 #7)].
 *
 * The variant note strings use `^` to raise a degree above its natural-minor
 * value (e.g. A harm = ABcdef^ga) and `=` when the natural-minor value is
 * already flatted by the key sig and we need it natural (e.g. C harm:
 * CDEFGA=Bc — `=B` overrides the Bb from K:Cm).
 */
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
    {
      id: `${idBase}-natural-minor`,
      name: `${tonic} natural minor`,
      tonic,
      family: 'natural-minor' as TechniqueFamily,
      variant: 'natural' as const,
      abc: abc(`${tonic} natural minor`, key, nat),
      difficulty: diff,
    },
    {
      id: `${idBase}-harmonic-minor`,
      name: `${tonic} harmonic minor`,
      tonic,
      family: 'harmonic-minor' as TechniqueFamily,
      variant: 'harmonic' as const,
      abc: abc(`${tonic} harmonic minor`, key, harm),
      difficulty: diff,
    },
    {
      id: `${idBase}-melodic-minor`,
      name: `${tonic} melodic minor`,
      tonic,
      family: 'melodic-minor' as TechniqueFamily,
      variant: 'melodic' as const,
      abc: abc(`${tonic} melodic minor (asc.)`, key, mel),
      difficulty: diff,
    },
  ];
});

/* ─── 24 arpeggios (12 major + 12 minor, one octave ascending + descending) ─ */
const MAJOR_ARP_KEYS: Array<[id: string, tonic: string, key: string, notes: string]> = [
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

const MINOR_ARP_KEYS: Array<[id: string, tonic: string, key: string, notes: string]> = [
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

export const SCALES: Scale[] = [...MAJORS, ...MINORS, ...ARPEGGIOS].map(build);

/** Daily routine — the user's "warmup order". */
export const DAILY_ROUTINE_IDS: string[] = [
  'c-major',
  'g-major',
  'd-major',
  'a-natural-minor',
  'e-natural-minor',
  'c-major-arp',
  'a-minor-arp',
];

/** Lookups for the session view and other consumers. */
export const SCALE_BY_ID: Map<string, Scale> = new Map(SCALES.map((s) => [s.id, s]));

/** Buckets in display order for the technique view. */
export const MINOR_VARIANTS = ['natural', 'harmonic', 'melodic'] as const;
export type MinorVariant = (typeof MINOR_VARIANTS)[number];

export const ARPEGGIO_QUALITIES = ['major', 'minor'] as const;
export type ArpeggioQuality = (typeof ARPEGGIO_QUALITIES)[number];

export const MINOR_FAMILY_BY_VARIANT: Record<MinorVariant, TechniqueFamily> = {
  natural: 'natural-minor',
  harmonic: 'harmonic-minor',
  melodic: 'melodic-minor',
};

export const ARP_FAMILY_BY_QUALITY: Record<ArpeggioQuality, TechniqueFamily> = {
  major: 'major-arpeggio',
  minor: 'minor-arpeggio',
};
