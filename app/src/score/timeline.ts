/**
 * Score-time: the one definition of *when* an event happens.
 *
 * §Score-time. Everything is exact `Fraction`s in quarter-note units from the
 * start of the score — the same unit as Verovio's `qstamp`, without its floats.
 * `timeline()` / `soundingEvents()` are the **only** source of expected onsets:
 * for MIDI assessment, for the generator's verify pass, for score↔recording
 * alignment and for the `scoreTime` anchor.
 *
 * The Verovio timemap is deliberately *not* that source. It lists every
 * tie-stop note as a fresh onset while Verovio's own MIDI export merges the
 * chain (`exp11`: a c4 tied across two halves gives timemap onsets at qstamp 0
 * and 2 but a single MIDI note-on), and it reports tuplet positions as IEEE
 * floats with `tstamp` rounded to integer ms (`exp02`). So the timemap is
 * joined by id for the cursor and nothing else, and `soundingEvents()` — which
 * returns tie-*start* ids only — is the assessment grid. Those two id sets are
 * different on purpose.
 */

import { effectiveAttrsByMeasure } from './attrs';
import { add, cmp, durationOf, meterLength, sub, toNumber, ZERO } from './fraction';
import { midiOf } from './pitch';
import type {
  Chord,
  Duration,
  ElementId,
  Fraction,
  MeasureRest,
  Note,
  Rest,
  ScoreDoc,
} from './types';

export { beatUnit, effectiveAttrs, effectiveAttrsByMeasure } from './attrs';
export type { EffectiveAttrs } from './attrs';

/** One per Note, ChordNote, Rest or MeasureRest. */
export interface TimelineEvent {
  id: ElementId;
  measureId: ElementId;
  measureIndex: number;
  staffIndex: 0 | 1;
  hand: 'rh' | 'lh';
  voiceN: 1 | 2;
  /** Absolute, quarter notes from the start of the score. */
  onset: Fraction;
  /**
   * 0-based offset from the measure's notated start — a pickup's first event
   * has beat 0, and consumers right-align a pickup with
   * `meter − pickupLength + beat`.
   */
  beat: Fraction;
  /** Notated; a MeasureRest's duration is the effective meter. */
  duration: Fraction;
  /** False for rests and tie-stop notes. */
  sounding: boolean;
}

/** Tie-merged, chord-collapsed, rest-free: the assessment grid. */
export interface SoundingEvent {
  /** The Note or Chord whose non-tie-stop noteheads start here. */
  id: ElementId;
  onset: Fraction;
  staffIndex: 0 | 1;
  hand: 'rh' | 'lh';
  voiceN: 1 | 2;
  pitches: Array<{
    noteId: ElementId;
    midi: number;
    /** The ids continuing this pitch, in order; empty when nothing is tied on. */
    tiedNoteIds: ElementId[];
    /** This pitch's whole chain, which may differ from its neighbours' in the same chord. */
    tiedDuration: Fraction;
  }>;
}

/**
 * A single flattened event with its position resolved. Tuplet members appear
 * individually (with their ratio already applied to `duration`); the tuplet
 * itself does not, because nothing downstream times a tuplet.
 *
 * Exported because `schema.ts` pairs ties over exactly this sequence: the tie
 * rule is "the immediately following event in the same staff and `Voice.n`",
 * which is only well defined against one agreed flattening.
 */
export interface PositionedEvent {
  event: Note | Chord | Rest | MeasureRest;
  onset: Fraction;
  beat: Fraction;
  duration: Fraction;
  measureIndex: number;
  measureId: ElementId;
  staffIndex: number;
  voiceN: number;
}

export interface Positions {
  events: PositionedEvent[];
  /** Keyed `${staffIndex}:${voiceN}`, in score order — the tie-pairing sequence. */
  byVoice: Map<string, PositionedEvent[]>;
  /** Absolute onset of each measure. */
  measureOnsets: Fraction[];
  /** Notated length of each measure: the meter, or the actual sum for a pickup/complement. */
  measureLengths: Fraction[];
}

const voiceKey = (staffIndex: number, voiceN: number): string => `${staffIndex}:${voiceN}`;

/** Sum of one voice's event durations, tuplet ratios applied. Tolerant of invalid docs. */
export function voiceLength(events: ReadonlyArray<Note | Chord | Rest | MeasureRest | { kind: 'tuplet'; num: number; numbase: number; events: Array<Note | Chord | Rest> }>, meter: Fraction): Fraction {
  let total = ZERO;
  for (const e of events) {
    if (e.kind === 'measureRest') return meter;
    if (e.kind === 'tuplet') {
      const ratio = { num: e.num, numbase: e.numbase };
      for (const te of e.events) total = add(total, durationOf(te.duration, ratio));
      continue;
    }
    total = add(total, durationOf((e as Note | Chord | Rest).duration));
  }
  return total;
}

/**
 * Flatten the document into positioned events.
 *
 * A measure's onset is the sum of the effective meter of every preceding
 * measure, except that a pickup or complement contributes its *actual* length
 * (§Score-time). A `MeasureRest` occupies the whole measure — and note that
 * Verovio agrees only outside a pickup: under `metcon="false"` it still times
 * `<mRest>` as a full bar (`exp22` H), which is why refinement 2 forbids one
 * there and those measures carry explicit rests.
 */
export function positions(doc: ScoreDoc): Positions {
  const attrs = effectiveAttrsByMeasure(doc);
  const events: PositionedEvent[] = [];
  const byVoice = new Map<string, PositionedEvent[]>();
  const measureOnsets: Fraction[] = [];
  const measureLengths: Fraction[] = [];

  let cursor = ZERO;
  doc.measures.forEach((measure, mi) => {
    const meter = meterLength(attrs[mi].timeSig);
    // A pickup or complement is deliberately short; every other measure is the
    // meter by refinement 2, so the meter is the safe length even when a
    // malformed voice disagrees (this runs before validation, for validation).
    let length = meter;
    if (measure.pickup || measure.complement) {
      const first = measure.staves[0]?.voices[0];
      length = first ? voiceLength(first.events, meter) : meter;
    }
    measureOnsets.push(cursor);
    measureLengths.push(length);

    measure.staves.forEach((staff, si) => {
      staff.voices.forEach((voice) => {
        const key = voiceKey(si, voice.n);
        if (!byVoice.has(key)) byVoice.set(key, []);
        const seq = byVoice.get(key) as PositionedEvent[];
        let beat = ZERO;
        const push = (event: PositionedEvent['event'], duration: Fraction): void => {
          const pe: PositionedEvent = {
            event,
            onset: add(cursor, beat),
            beat,
            duration,
            measureIndex: mi,
            measureId: measure.id,
            staffIndex: si,
            voiceN: voice.n,
          };
          events.push(pe);
          seq.push(pe);
          beat = add(beat, duration);
        };
        for (const e of voice.events) {
          if (e.kind === 'tuplet') {
            const ratio = { num: e.num, numbase: e.numbase };
            for (const te of e.events) push(te, durationOf(te.duration, ratio));
          } else if (e.kind === 'measureRest') {
            push(e, length);
          } else {
            push(e, durationOf(e.duration));
          }
        }
      });
    });

    cursor = add(cursor, length);
  });

  return { events, byVoice, measureOnsets, measureLengths };
}

/** One entry per notehead, rest and measure rest, in score order. */
export function timeline(doc: ScoreDoc): TimelineEvent[] {
  const pos = positions(doc);
  const out: TimelineEvent[] = [];
  for (const pe of pos.events) {
    const base = {
      measureId: pe.measureId,
      measureIndex: pe.measureIndex,
      staffIndex: pe.staffIndex as 0 | 1,
      hand: doc.staves[pe.staffIndex].hand,
      voiceN: pe.voiceN as 1 | 2,
      onset: pe.onset,
      beat: pe.beat,
      duration: pe.duration,
    };
    if (pe.event.kind === 'chord') {
      for (const n of pe.event.notes) {
        out.push({ ...base, id: n.id, sounding: n.tie !== 'stop' && n.tie !== 'both' });
      }
    } else if (pe.event.kind === 'note') {
      out.push({ ...base, id: pe.event.id, sounding: pe.event.tie !== 'stop' && pe.event.tie !== 'both' });
    } else {
      out.push({ ...base, id: pe.event.id, sounding: false });
    }
  }
  out.sort((a, b) => cmp(a.onset, b.onset) || a.staffIndex - b.staffIndex || a.voiceN - b.voiceN);
  return out;
}

interface Notehead {
  id: ElementId;
  pitch: Note['pitch'];
  tie?: Note['tie'];
}

function noteheads(e: PositionedEvent['event']): Notehead[] {
  if (e.kind === 'note') return [{ id: e.id, pitch: e.pitch, tie: e.tie }];
  if (e.kind === 'chord') return e.notes.map((n) => ({ id: n.id, pitch: n.pitch, tie: n.tie }));
  return [];
}

/**
 * The tie chain starting at `head`: the following events in the same
 * (staff, `Voice.n`) sequence whose matching notehead carries `'stop'` or
 * `'both'`, walked while the chain continues. Pairing is by rule, not by
 * reference (§Rules), so this walk is also what `schema.ts` validates against.
 */
function followChain(
  seq: PositionedEvent[],
  index: number,
  head: Notehead,
): { ids: ElementId[]; duration: Fraction; broken: boolean } {
  const ids: ElementId[] = [];
  let duration = seq[index].duration;
  let i = index;
  let current = head;
  while (current.tie === 'start' || current.tie === 'both') {
    const next = seq[i + 1];
    if (!next || next.measureIndex > seq[i].measureIndex + 1) return { ids, duration, broken: true };
    const match = noteheads(next.event).find(
      (n) =>
        n.pitch.step === current.pitch.step &&
        n.pitch.alter === current.pitch.alter &&
        n.pitch.octave === current.pitch.octave &&
        (n.tie === 'stop' || n.tie === 'both'),
    );
    if (!match) return { ids, duration, broken: true };
    ids.push(match.id);
    duration = add(duration, next.duration);
    i += 1;
    current = match;
  }
  return { ids, duration, broken: false };
}

/** Exposed for `schema.ts`'s tie refinement, which needs the same walk. */
export function tieChain(
  seq: PositionedEvent[],
  index: number,
  head: { id: ElementId; pitch: Note['pitch']; tie?: Note['tie'] },
): { ids: ElementId[]; duration: Fraction; broken: boolean } {
  return followChain(seq, index, head);
}

/**
 * The assessment grid: one event per moment a chord or note *starts* sounding,
 * carrying only the noteheads that are not tie-stops. A chord tied in on some
 * notes contributes just its new pitches; a chord all of whose notes are
 * tie-stops yields no event at all.
 */
export function soundingEvents(doc: ScoreDoc): SoundingEvent[] {
  const pos = positions(doc);
  const out: SoundingEvent[] = [];
  for (const seq of pos.byVoice.values()) {
    seq.forEach((pe, i) => {
      const heads = noteheads(pe.event);
      if (heads.length === 0) return;
      const starts = heads.filter((n) => n.tie !== 'stop' && n.tie !== 'both');
      if (starts.length === 0) return;
      out.push({
        id: pe.event.id,
        onset: pe.onset,
        staffIndex: pe.staffIndex as 0 | 1,
        hand: doc.staves[pe.staffIndex].hand,
        voiceN: pe.voiceN as 1 | 2,
        pitches: starts.map((n) => {
          const chain = followChain(seq, i, n);
          return {
            noteId: n.id,
            midi: midiOf(n.pitch),
            tiedNoteIds: chain.ids,
            tiedDuration: chain.duration,
          };
        }),
      });
    });
  }
  out.sort((a, b) => cmp(a.onset, b.onset) || a.staffIndex - b.staffIndex || a.voiceN - b.voiceN);
  return out;
}

/** Quarter notes per minute for a `Tempo` — `bpm × quarterLength(unit)`. */
export function quarterBpmOf(tempo: { bpm: number; unit: Duration }): number {
  return tempo.bpm * toNumber(durationOf(tempo.unit));
}

/** `t × 60000 / quarterBpm`. Single-tempo spans (generated exercises). */
export function msAt(t: Fraction, quarterBpm: number): number {
  return (toNumber(t) * 60000) / quarterBpm;
}

/** The tempo in force from each score-time position, in document order. */
export function tempoMap(doc: ScoreDoc): Array<{ from: Fraction; quarterBpm: number }> {
  const pos = positions(doc);
  const out: Array<{ from: Fraction; quarterBpm: number }> = [
    { from: ZERO, quarterBpm: quarterBpmOf(doc.tempo) },
  ];
  doc.measures.forEach((m, i) => {
    if (!m.tempo) return;
    const quarterBpm = quarterBpmOf(m.tempo);
    const from = pos.measureOnsets[i];
    if (out[out.length - 1].quarterBpm === quarterBpm) return;
    out.push({ from, quarterBpm });
  });
  return out;
}

/** Integrate a `tempoMap` segment by segment up to `t`. */
export function msAtMap(t: Fraction, map: Array<{ from: Fraction; quarterBpm: number }>): number {
  let ms = 0;
  for (let i = 0; i < map.length; i += 1) {
    const start = map[i].from;
    if (cmp(start, t) >= 0) break;
    const nextStart = map[i + 1]?.from;
    const end = nextStart && cmp(nextStart, t) < 0 ? nextStart : t;
    ms += msAt(sub(end, start), map[i].quarterBpm);
  }
  return ms;
}

/** The absolute onset of an element id (notehead, rest, measure rest or measure). */
export function onsetOf(doc: ScoreDoc, id: ElementId): Fraction | null {
  const mi = doc.measures.findIndex((m) => m.id === id);
  const pos = positions(doc);
  if (mi >= 0) return pos.measureOnsets[mi];
  for (const pe of pos.events) {
    if (pe.event.id === id) return pe.onset;
    if (pe.event.kind === 'chord' && pe.event.notes.some((n) => n.id === id)) return pe.onset;
  }
  return null;
}

/** Score-time length of the whole document. */
export function totalLength(doc: ScoreDoc): Fraction {
  const pos = positions(doc);
  const n = doc.measures.length - 1;
  return n < 0 ? ZERO : add(pos.measureOnsets[n], pos.measureLengths[n]);
}
