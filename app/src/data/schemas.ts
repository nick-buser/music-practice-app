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
