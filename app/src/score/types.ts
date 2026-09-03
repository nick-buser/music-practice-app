/**
 * The ScoreDoc model, written out as plain TypeScript interfaces.
 *
 * Why a hand-written type file next to `schema.ts` rather than just
 * `z.infer<>`: the model is a *contract* read by SC2–SC9, SR2, SR5 and SR6,
 * and `docs/score-substrate.md` §ScoreDoc shape is written as this shape.
 * Keeping the declarations here means the contract reads the way the doc
 * reads, and `schema.ts` proves at compile time that the zod schema and
 * these interfaces are mutually assignable (`schemaMatchesModel`), so the
 * two can never drift.
 *
 * Nothing here is a runtime value — this module compiles away entirely, so
 * it is safe for `fraction.ts` and every other leaf module to depend on.
 */

/** Exact rational, always reduced, `den > 0`. Compared by cross-multiplication. */
export interface Fraction {
  num: number;
  den: number;
}

export type ElementKind =
  | 'measure'
  | 'voice'
  | 'note'
  | 'chord'
  | 'rest'
  | 'measureRest'
  | 'tuplet'
  | 'slur'
  | 'hairpin'
  | 'dynamic'
  | 'staffDef';

/** Stored ids match `STORED_ID_RE` exactly; the `-suffix` form is reserved for derived ids. */
export type ElementId = string;

/**
 * A generated exercise's recipe, carried verbatim (never a hash) so a score
 * row can be regenerated from itself. `spec` stays opaque here: the `Spec`
 * type is owned by the sight-reading generator (docs/sight-reading-generation.md
 * line 604) and lands with SR1 — TODO(SR1): replace `JsonValue` with `Spec`.
 */
export interface Recipe {
  generatorVersion: string;
  scorerVersion: string;
  taxonomyVersion: string;
  spec: JsonValue;
  /** uint32 */
  seed: number;
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export interface ScoreMeta {
  title: string;
  source: 'generated' | 'authored' | 'imported';
  /** Required iff `source === 'generated'`. */
  recipe?: Recipe;
  /** Required iff `source === 'imported'`. */
  provenance?: {
    runId: string;
    extractor: string;
    extractorVersion: string;
    inputSha256s: string[];
  };
  /** `scoreDocHash` of a native parent, blob sha256 of a foreign parent. */
  derivedFrom?: { scoreId: string; hash: string };
}

export interface StaffDef {
  id: ElementId;
  clef: 'treble' | 'bass';
  hand: 'rh' | 'lh';
}

export interface KeySig {
  fifths: -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  mode: 'major' | 'minor';
}

export interface TimeSig {
  count: number;
  unit: 2 | 4 | 8;
  sym?: 'common' | 'cut';
  /** Required iff (count, unit) ∈ {(5,8), (7,8)}; entries ∈ {2,3} summing to count. */
  grouping?: Array<2 | 3>;
}

export type DurBase = 1 | 2 | 4 | 8 | 16 | 32;

export interface Duration {
  base: DurBase;
  dots: 0 | 1 | 2;
}

/** bpm integer 20..300; `text` is the display word ("Andante"). */
export interface Tempo {
  bpm: number;
  unit: Duration;
  text?: string;
}

export interface SpelledPitch {
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  /** The *sounding* alteration, key signature already applied. */
  alter: -2 | -1 | 0 | 1 | 2;
  /** Integer 0..8, scientific: C4 = middle C = MIDI 60 (identical to MEI @oct). */
  octave: number;
}

export type Articulation = 'staccato' | 'accent' | 'tenuto' | 'marcato' | 'staccatissimo';
export type Finger = 1 | 2 | 3 | 4 | 5;
/** MEI `i | t | m`. */
export type TieRole = 'start' | 'stop' | 'both';

export interface Note {
  kind: 'note';
  id: ElementId;
  pitch: SpelledPitch;
  duration: Duration;
  tie?: TieRole;
  courtesy?: true;
  articulations?: Articulation[];
  fingering?: Finger;
}

/** MEI `<note>` inside `<chord>`: no `@dur` of its own. */
export interface ChordNote {
  id: ElementId;
  pitch: SpelledPitch;
  tie?: TieRole;
  courtesy?: true;
  fingering?: Finger;
}

export interface Chord {
  kind: 'chord';
  id: ElementId;
  duration: Duration;
  /** ≥ 2, strictly ascending by `midiOf(pitch)`. */
  notes: ChordNote[];
  articulations?: Articulation[];
}

export interface Rest {
  kind: 'rest';
  id: ElementId;
  duration: Duration;
}

/** MEI `<mRest/>`; the only event in its voice; never in a pickup or complement. */
export interface MeasureRest {
  kind: 'measureRest';
  id: ElementId;
}

export interface TupletGroup {
  kind: 'tuplet';
  id: ElementId;
  /** MEI `@num`/`@numbase`: `num` in the time of `numbase`, e.g. 3:2. */
  num: number;
  numbase: number;
  /** ≥ 2; no nested tuplets in v1. */
  events: Array<Note | Chord | Rest>;
}

export type Event = Note | Chord | Rest | MeasureRest | TupletGroup;

export type Spanner =
  | { kind: 'slur'; id: ElementId; startId: ElementId; endId: ElementId }
  | { kind: 'hairpin'; id: ElementId; startId: ElementId; endId: ElementId; form: 'cres' | 'dim' };

export type Direction = {
  kind: 'dynamic';
  id: ElementId;
  at: ElementId;
  value: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
};

/** `n` is the MEI layer `@n`; `id` identifies this voice-in-this-measure. */
export interface Voice {
  id: ElementId;
  n: 1 | 2;
  events: Event[];
}

export interface MeasureStaff {
  voices: Voice[];
}

export interface Measure {
  id: ElementId;
  /** Anacrusis; `measures[0]` only; MEI `metcon="false"`. */
  pickup?: true;
  /** The last measure only, legal iff `measures[0].pickup`; MEI `metcon="false"`. */
  complement?: true;
  /** A forced system break BEFORE this measure; MEI `<sb/>`; never on `measures[0]`. */
  systemBreak?: true;
  /** A CHANGE taking effect at this measure; never on `measures[0]`. */
  keySig?: KeySig;
  timeSig?: TimeSig;
  tempo?: Tempo;
  /** Index-aligned with `doc.staves`, exactly `staves.length` entries. */
  staves: MeasureStaff[];
  /** Slurs and hairpins that START in this measure. */
  spanners: Spanner[];
  /** Dynamics attached to an event in this measure. */
  directions: Direction[];
}

export interface ScoreDoc {
  schemaVersion: 1;
  /** UUID — equals the `scores.id` row. */
  id: string;
  /** Bumped by every persisted command batch; 1 at creation. */
  revision: number;
  meta: ScoreMeta;
  /** Piano v1: exactly two. */
  staves: StaffDef[];
  /** REQUIRED initial state → `<scoreDef>`; never repeated on `measures[0]`. */
  keySig: KeySig;
  timeSig: TimeSig;
  tempo: Tempo;
  measures: Measure[];
}

/** The current `schemaVersion`; `migrate.ts` upgrades anything below it. */
export const SCORE_SCHEMA_VERSION = 1;

export type IssueCode =
  | 'schema'
  | 'id-pattern'
  | 'id-duplicate'
  | 'voice-overfull'
  | 'voice-underfull'
  | 'pickup-not-short'
  | 'pickup-mrest'
  | 'complement-length'
  | 'staff-count'
  | 'voice-n'
  | 'mrest-not-alone'
  | 'chord-size'
  | 'chord-duplicate-pitch'
  | 'tuplet-ratio'
  | 'tie-dangling'
  | 'tie-orphan-stop'
  | 'endpoint-unresolved'
  | 'spanner-order'
  | 'spanner-measure'
  | 'courtesy-redundant'
  | 'range'
  | 'pickup-position'
  | 'complement-position'
  | 'systembreak-position'
  | 'initial-state-on-measure'
  | 'timesig-set'
  | 'timesig-grouping'
  | 'timesig-sym';

export interface Issue {
  code: IssueCode;
  path: Array<string | number>;
  message: string;
  ids?: ElementId[];
}
