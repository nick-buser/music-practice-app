import { z } from 'zod';

export const InstrumentId = z.enum(['piano', 'guitar', 'voice', 'compose']);
export type InstrumentId = z.infer<typeof InstrumentId>;

export const Depth = z.enum(['surface', 'shallow', 'deep', 'mastered']);
export type Depth = z.infer<typeof Depth>;

export const Instrument = z.object({
  id: InstrumentId,
  name: z.string(),
  latin: z.string(),
  count: z.number().int().nonnegative(),
});
export type Instrument = z.infer<typeof Instrument>;

export const PlanItem = z.object({
  text: z.string(),
  done: z.boolean(),
  active: z.boolean().optional(),
});
export type PlanItem = z.infer<typeof PlanItem>;

export const Section = z.object({
  id: z.string(),
  range: z.string(),
  label: z.string(),
  subtitle: z.string(),
  heat: z.number().min(0).max(1),
  conf: z.number().int().min(0).max(5),
  tempo: z.string(),
  reps: z.number().int().nonnegative(),
  struggle: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type Section = z.infer<typeof Section>;

export const Note = z.object({
  when: z.string(),
  body: z.string(),
});
export type Note = z.infer<typeof Note>;

export const HistoryEntry = z.object({
  date: z.string(),
  mins: z.number().int().nonnegative(),
});
export type HistoryEntry = z.infer<typeof HistoryEntry>;

export const Piece = z.object({
  id: z.string(),
  instrument: InstrumentId,
  title: z.string(),
  subtitle: z.string(),
  composer: z.string(),
  year: z.number().int(),
  key: z.string(),
  meter: z.string(),
  tempo: z.object({ mark: z.string(), bpm: z.number().int() }),
  duration: z.string(),
  measures: z.number().int(),
  depth: Depth,
  depthLabel: z.string(),
  started: z.string(),
  lastTouched: z.string(),
  progressPct: z.number().min(0).max(1),
  minutesTotal: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  plan: z.array(PlanItem),
  sections: z.array(Section),
  notes: z.array(Note),
  history: z.array(HistoryEntry),
  /** Optional MEI snippet for Verovio rendering — opening bars, used for thumbnails and detail view. */
  mei: z.string().optional(),
});
export type Piece = z.infer<typeof Piece>;

export const QueueItem = z.object({
  id: z.string(),
  pieceId: z.string(),
  label: z.string(),
  sub: z.string(),
  mins: z.number().int().nonnegative(),
});
export type QueueItem = z.infer<typeof QueueItem>;

export const Quote = z.object({
  text: z.string(),
  who: z.string(),
});
export type Quote = z.infer<typeof Quote>;

export const Chord = z.object({
  /** Chord symbol, e.g. "F♯m", "D maj9". */
  symbol: z.string(),
  /** Roman-numeral function, e.g. "i", "VI". */
  roman: z.string(),
});
export type Chord = z.infer<typeof Chord>;

export const Sketch = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  status: z.string(),
  started: z.string(),
  lastTouched: z.string(),
  keyArea: z.string(),
  meter: z.string(),
  duration: z.string(),
  tags: z.array(z.string()),
  /** Lyric / program note, with [section] markers and { } annotations. */
  lyric: z.string(),
  plan: z.array(PlanItem),
  /** Optional chord progression for the harmony tab. */
  harmony: z.array(Chord).optional(),
  /** Optional ABC snippet engraved (via Verovio) under the harmony tab. */
  harmonyAbc: z.string().optional(),
});
export type Sketch = z.infer<typeof Sketch>;

export const TechniqueFamily = z.enum([
  'major',
  'natural-minor',
  'harmonic-minor',
  'melodic-minor',
  'major-arpeggio',
  'minor-arpeggio',
  // Triad block chords
  'major-chord',
  'minor-chord',
  // 7th chord blocks (root position)
  'maj7-chord',
  'dom7-chord',
  'min7-chord',
  // 9th chord blocks (root position)
  'maj9-chord',
  'dom9-chord',
  'min9-chord',
  // 11th chord blocks (root position)
  'maj11-chord',
  'dom11-chord',
  'min11-chord',
  // 13th chord blocks (root position).
  'maj13-chord',
  'dom13-chord',
  'min13-chord',
  // Altered dominants (and friends).
  '7b5-chord',
  '7s5-chord',
  '7b9-chord',
  '7s9-chord',
  '7s11-chord',
  '13b9-chord',
  // Half/fully diminished + lydian major.
  // Next: 7alt, maj7♯5.
  'm7b5-chord',
  'dim7-chord',
  'maj7s11-chord',
]);
export type TechniqueFamily = z.infer<typeof TechniqueFamily>;

export const ScaleVariant = z.enum(['natural', 'harmonic', 'melodic']);
export type ScaleVariant = z.infer<typeof ScaleVariant>;

/**
 * A practice "drill" — a scale, arpeggio, or chord exercise. Scales/arpeggios
 * are engraved as a melodic line; chords as a vertical block. They share the
 * same tracking shape (comfort / lastTouched / tempo / reps) so the technique
 * view can list them in one grid.
 */
export const Drill = z.object({
  id: z.string(),
  /** Display name, e.g. "C major", "A harmonic minor", "C major chord". */
  name: z.string(),
  /** Tonic letter (with accidental), e.g. "C", "F♯". */
  tonic: z.string(),
  family: TechniqueFamily,
  /** Only set on the three minor scale families. */
  variant: ScaleVariant.optional(),
  /** ABC engraving. */
  abc: z.string(),
  /** 0–1, mirrors piece-depth color bands. */
  comfort: z.number().min(0).max(1),
  /** ISO date of the last time this was practised. Null if never. */
  lastTouched: z.string().nullable(),
  /** Aim-for tempo, in bpm of the unit note. */
  bpmTarget: z.number().int().positive(),
  /** Where they're working today. */
  bpmCurrent: z.number().int().positive(),
  /** Practice reps logged across all sessions. */
  reps: z.number().int().nonnegative(),
});
export type Drill = z.infer<typeof Drill>;

/** Back-compat alias — the type was called `Scale` before chords joined. */
export const Scale = Drill;
export type Scale = Drill;
