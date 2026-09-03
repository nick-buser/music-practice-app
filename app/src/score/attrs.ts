/**
 * Effective key/meter/tempo at a measure, and the beat unit a metronome clicks.
 *
 * §Rules, "Initial state lives on the document, changes on the measure": the
 * document's `keySig`/`timeSig`/`tempo` are the initial state and `measures[0]`
 * never repeats them (refinement 8); a later measure carries only a *change*.
 * So "what is in force here" is a walk, not a field, and every consumer that
 * needs it — the serializer's `<scoreDef>` re-declarations, the duration
 * refinement, the timeline, the accidental walk — has to agree on the answer.
 *
 * This lives in its own module rather than in `timeline.ts` (which re-exports
 * it, per the ticket's stated surface) only so `pitch.ts` can use it without
 * an import cycle: `timeline.ts` depends on `pitch.ts` for `midiOf`.
 */

import { durationOf, frac, meterLength } from './fraction';
import type { Fraction, KeySig, ScoreDoc, Tempo, TimeSig } from './types';

export interface EffectiveAttrs {
  measureIndex: number;
  keySig: KeySig;
  timeSig: TimeSig;
  tempo: Tempo;
}

/** The last explicit value at or before `measureId`. Throws if the id is not a measure. */
export function effectiveAttrs(doc: ScoreDoc, measureId: string): EffectiveAttrs {
  let keySig = doc.keySig;
  let timeSig = doc.timeSig;
  let tempo = doc.tempo;
  for (let i = 0; i < doc.measures.length; i += 1) {
    const m = doc.measures[i];
    if (m.keySig) keySig = m.keySig;
    if (m.timeSig) timeSig = m.timeSig;
    if (m.tempo) tempo = m.tempo;
    if (m.id === measureId) return { measureIndex: i, keySig, timeSig, tempo };
  }
  throw new Error(`effectiveAttrs: no measure with id ${measureId}`);
}

/** The same walk for every measure at once — one pass instead of one per measure. */
export function effectiveAttrsByMeasure(doc: ScoreDoc): EffectiveAttrs[] {
  let keySig = doc.keySig;
  let timeSig = doc.timeSig;
  let tempo = doc.tempo;
  return doc.measures.map((m, i) => {
    if (m.keySig) keySig = m.keySig;
    if (m.timeSig) timeSig = m.timeSig;
    if (m.tempo) tempo = m.tempo;
    return { measureIndex: i, keySig, timeSig, tempo };
  });
}

/**
 * The pulse a metronome clicks: a dotted `(unit/2)`-note in a compound meter,
 * else the `unit`-note. `TimeSig.unit` is 2 | 4 | 8, so `unit === 8` is exactly
 * the doc's `unit ≥ 8` condition; the parameter is widened to plain numbers
 * only so `lib/time.ts beatsPerBar` can pass a meter string it did not validate.
 */
export function beatUnit(timeSig: { count: number; unit: number }): { base: number; dots: 0 | 1 } {
  if (timeSig.unit === 8 && timeSig.count % 3 === 0) return { base: timeSig.unit / 2, dots: 1 };
  return { base: timeSig.unit, dots: 0 };
}

/** Beats per bar as an exact fraction: `count × 4/unit ÷ durationOf(beatUnit)`. */
export function beatsPerBarExact(timeSig: { count: number; unit: number }): Fraction {
  const bar = meterLength(timeSig);
  const beat = durationOf(beatUnit(timeSig));
  return frac(bar.num * beat.den, bar.den * beat.num);
}
