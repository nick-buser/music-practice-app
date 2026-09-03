// @vitest-environment node
// Verovio's WASM toolkit loads under node, not jsdom (every script in
// docs/probes/verovio runs under node). Per-file, so nothing else moves.
import { beforeAll, describe, expect, it } from 'vitest';
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

import {
  grandStaffExercise,
  pickupAndComplement,
  POSITIVE_FIXTURES,
  sixEight,
  unevenTriplet,
  windowed,
} from './__fixtures__';
import { formatFraction, frac, toNumber } from './fraction';
import {
  beatUnit,
  effectiveAttrs,
  msAt,
  msAtMap,
  onsetOf,
  positions,
  quarterBpmOf,
  soundingEvents,
  tempoMap,
  timeline,
  totalLength,
} from './timeline';
import { renderScoreDocOn } from '../verovio/toolkit';
import type { ChordNote, ElementId, Note, ScoreDoc } from './types';

/* -------------------------------------------------------------------------
 * Pure score-time.
 * ----------------------------------------------------------------------- */

describe('timeline', () => {
  it('accumulates measure onsets from the effective meter', () => {
    const doc = grandStaffExercise();
    const onsets = positions(doc).measureOnsets.map(formatFraction);
    expect(onsets).toEqual(['0', '4', '8', '12', '16', '20', '24', '28']);
    expect(formatFraction(totalLength(doc))).toBe('32');
  });

  it('gives a pickup its actual length and right-aligns nothing itself', () => {
    const doc = pickupAndComplement();
    const pos = positions(doc);
    // A quarter-note pickup, then full bars, then a complement of meter − pickup.
    expect(pos.measureLengths.map(formatFraction)).toEqual(['1', '4', '4', '3']);
    expect(pos.measureOnsets.map(formatFraction)).toEqual(['0', '1', '5', '9']);
    const first = timeline(doc)[0];
    expect(formatFraction(first.beat)).toBe('0');
  });

  it('scales tuplet members by numbase/num', () => {
    const doc = unevenTriplet();
    const beats = timeline(doc)
      .filter((t) => t.staffIndex === 0)
      .map((t) => formatFraction(t.beat));
    // ♪ ♬ ♪ under 3:2 = 1/3 + 1/6 + 1/6 + 1/3 of a quarter, then a quarter and a half.
    expect(beats).toEqual(['0', '1/3', '1/2', '2/3', '1', '2']);
  });

  it('gives a MeasureRest the effective meter as its duration', () => {
    const doc = sixEight();
    const mrest = timeline(doc).find((t) => t.measureIndex === 1 && t.staffIndex === 1);
    expect(formatFraction(mrest?.duration ?? frac(0))).toBe('3');
  });

  it('carries hand, voice and measure identity on every entry', () => {
    const doc = grandStaffExercise();
    const entries = timeline(doc);
    expect(entries.every((t) => t.hand === (t.staffIndex === 0 ? 'rh' : 'lh'))).toBe(true);
    const twoVoices = entries.filter((t) => t.measureIndex === 6 && t.staffIndex === 1);
    expect(new Set(twoVoices.map((t) => t.voiceN))).toEqual(new Set([1, 2]));
  });

  it('marks rests and tie-stops as not sounding', () => {
    const doc = grandStaffExercise();
    const stop = doc.measures[2].staves[0].voices[0].events[0];
    const entry = timeline(doc).find((t) => t.id === stop.id);
    expect(entry?.sounding).toBe(false);
    const rests = timeline(pickupAndComplement()).filter((t) => !t.sounding);
    expect(rests.length).toBeGreaterThan(0);
  });
});

describe('soundingEvents', () => {
  it('merges a tie chain into one event and reports its whole duration', () => {
    const doc = grandStaffExercise();
    const start = doc.measures[1].staves[0].voices[0].events[2];
    const stop = doc.measures[2].staves[0].voices[0].events[0];
    const event = soundingEvents(doc).find((s) => s.id === start.id);
    expect(event).toBeDefined();
    expect(event?.pitches[0].tiedNoteIds).toEqual([stop.id]);
    // A half tied to a quarter is three quarter notes of sound.
    expect(formatFraction(event?.pitches[0].tiedDuration ?? frac(0))).toBe('3');
    // …and the tie-stop is not an event of its own.
    expect(soundingEvents(doc).some((s) => s.id === stop.id)).toBe(false);
  });

  it('returns exactly the ids of events with at least one non-tie-stop notehead', () => {
    for (const [name, make] of POSITIVE_FIXTURES) {
      const doc = make();
      const expected = new Set<ElementId>();
      for (const pe of positions(doc).events) {
        const heads: Array<Note | ChordNote> =
          pe.event.kind === 'note' ? [pe.event] : pe.event.kind === 'chord' ? pe.event.notes : [];
        if (heads.some((h) => h.tie !== 'stop' && h.tie !== 'both')) expected.add(pe.event.id);
      }
      expect(new Set(soundingEvents(doc).map((s) => s.id)), name).toEqual(expected);
    }
  });

  it('collapses a chord to one event carrying every notehead', () => {
    const doc = grandStaffExercise();
    const chord = doc.measures[0].staves[1].voices[0].events[0];
    if (chord.kind !== 'chord') throw new Error('fixture drift');
    const event = soundingEvents(doc).find((s) => s.id === chord.id);
    expect(event?.pitches.map((p) => p.noteId)).toEqual(chord.notes.map((n) => n.id));
    expect(event?.hand).toBe('lh');
  });

  it('holds no rests', () => {
    const doc = pickupAndComplement();
    const restIds = new Set(
      positions(doc).events.filter((pe) => pe.event.kind !== 'note' && pe.event.kind !== 'chord').map((pe) => pe.event.id),
    );
    for (const s of soundingEvents(doc)) expect(restIds.has(s.id)).toBe(false);
  });
});

describe('tempo', () => {
  it('normalizes a dotted-quarter tempo to quarter-note terms', () => {
    expect(quarterBpmOf({ bpm: 60, unit: { base: 4, dots: 1 } })).toBe(90);
    expect(quarterBpmOf({ bpm: 96, unit: { base: 4, dots: 0 } })).toBe(96);
    expect(quarterBpmOf({ bpm: 60, unit: { base: 2, dots: 0 } })).toBe(120);
  });

  it('converts score time to milliseconds', () => {
    expect(msAt(frac(4), 120)).toBe(2000);
    expect(msAt(frac(1, 3), 60)).toBeCloseTo(333.3333, 3);
  });

  it('integrates a mid-exercise tempo change segment by segment', () => {
    const doc = grandStaffExercise();
    const map = tempoMap(doc);
    expect(map.map((s) => [formatFraction(s.from), s.quarterBpm])).toEqual([
      ['0', 96],
      ['16', 72],
    ]);
    // 16 quarters at 96, then 4 at 72.
    expect(msAtMap(frac(16), map)).toBeCloseTo((16 * 60000) / 96, 6);
    expect(msAtMap(frac(20), map)).toBeCloseTo((16 * 60000) / 96 + (4 * 60000) / 72, 6);
    expect(msAtMap(frac(0), map)).toBe(0);
  });
});

describe('effectiveAttrs and beatUnit', () => {
  it('is the last explicit value at or before the measure', () => {
    const doc = grandStaffExercise();
    expect(effectiveAttrs(doc, doc.measures[3].id).keySig.fifths).toBe(1);
    expect(effectiveAttrs(doc, doc.measures[4].id).keySig.fifths).toBe(-1);
    expect(effectiveAttrs(doc, doc.measures[7].id).tempo.bpm).toBe(72);
    expect(effectiveAttrs(doc, doc.measures[0].id).tempo.bpm).toBe(96);
    expect(() => effectiveAttrs(doc, 'nope')).toThrow();
  });

  it('clicks a dotted (unit/2) note in a compound meter and the unit otherwise', () => {
    expect(beatUnit({ count: 6, unit: 8 })).toEqual({ base: 4, dots: 1 });
    expect(beatUnit({ count: 12, unit: 8 })).toEqual({ base: 4, dots: 1 });
    expect(beatUnit({ count: 5, unit: 8 })).toEqual({ base: 8, dots: 0 });
    expect(beatUnit({ count: 4, unit: 4 })).toEqual({ base: 4, dots: 0 });
    expect(beatUnit({ count: 2, unit: 2 })).toEqual({ base: 2, dots: 0 });
  });
});

/* -------------------------------------------------------------------------
 * Against the renderer.
 * ----------------------------------------------------------------------- */

interface Ids {
  all: ElementId[];
  noteheads: ElementId[];
  measureRests: ElementId[];
  rests: ElementId[];
}

function idsOf(doc: ScoreDoc): Ids {
  const all: ElementId[] = [];
  const noteheads: ElementId[] = [];
  const measureRests: ElementId[] = [];
  const rests: ElementId[] = [];
  for (const m of doc.measures) {
    all.push(m.id);
    for (const st of m.staves) {
      for (const v of st.voices) {
        all.push(v.id);
        const walk = (events: ScoreDoc['measures'][number]['staves'][number]['voices'][number]['events']): void => {
          for (const e of events) {
            all.push(e.id);
            if (e.kind === 'note') noteheads.push(e.id);
            if (e.kind === 'rest') rests.push(e.id);
            if (e.kind === 'measureRest') measureRests.push(e.id);
            if (e.kind === 'chord') {
              for (const n of e.notes) {
                all.push(n.id);
                noteheads.push(n.id);
              }
            }
            if (e.kind === 'tuplet') walk(e.events);
          }
        };
        walk(v.events);
      }
    }
    for (const sp of m.spanners) all.push(sp.id);
    for (const d of m.directions) all.push(d.id);
  }
  return { all, noteheads, measureRests, rests };
}

describe('timeline against Verovio', () => {
  let tk: VerovioToolkit;

  beforeAll(async () => {
    tk = new VerovioToolkit(await createVerovioModule());
  });

  it.each(POSITIVE_FIXTURES)('%s: every element id renders exactly once, and no sd… id at all', (_name, make) => {
    const doc = make();
    const { svg } = renderScoreDocOn(tk, doc, { widthPx: 1600 });
    const ids = idsOf(doc);
    for (const id of ids.all) {
      const count = (svg.match(new RegExp(`<g id="${id}"`, 'g')) ?? []).length;
      expect(count, `${id}`).toBe(1);
    }
    // §Rules: elements of <scoreDef> are never rendered and carry no id.
    for (const staffDef of doc.staves) expect(svg).not.toContain(staffDef.id);
    expect(svg).not.toContain('id="sdef"');
    // exp13c: a spanner continued onto the next system gets an id-less group
    // carrying `id-X spanning` classes — which is why "exactly once" holds.
    for (const m of svg.matchAll(/<g class="([^"]*\bspanning\b[^"]*)"/g)) {
      expect(m[1]).toMatch(/\bid-/);
    }
  });

  it.each(POSITIVE_FIXTURES)('%s: the timemap `on` union is every Note and ChordNote id, tie-stops included', (_name, make) => {
    const doc = make();
    const { timemap } = renderScoreDocOn(tk, doc, { widthPx: 1600 });
    const on = new Set<string>();
    for (const entry of timemap) for (const id of entry.on ?? []) on.add(id);
    // exp11: Verovio lists every tie-stop as a fresh onset, which is exactly
    // why soundingEvents() and this set are different collections.
    expect([...on].sort()).toEqual([...idsOf(doc).noteheads].sort());
  });

  it.each(POSITIVE_FIXTURES)('%s: no MeasureRest id ever appears in the timemap (exp22 K)', (_name, make) => {
    const doc = make();
    const { timemap } = renderScoreDocOn(tk, doc, { widthPx: 1600 });
    const serialized = JSON.stringify(timemap);
    for (const id of idsOf(doc).measureRests) expect(serialized).not.toContain(id);
  });

  it.each(POSITIVE_FIXTURES)('%s: timeline() onsets equal Verovio qstamp within 1e-6', (_name, make) => {
    const doc = make();
    const { timemap } = renderScoreDocOn(tk, doc, { widthPx: 1600 });
    const onsets = new Map(timeline(doc).map((t) => [t.id, toNumber(t.onset)]));
    let checked = 0;
    for (const entry of timemap) {
      for (const id of [...(entry.on ?? []), ...(entry.restsOn ?? [])]) {
        expect(onsets.get(id), `${id}`).toBeDefined();
        expect(Math.abs((onsets.get(id) as number) - entry.qstamp), `${id}`).toBeLessThan(1e-6);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('reports the tuplet onsets Verovio reports, floats and all', () => {
    const doc = unevenTriplet();
    const { timemap } = renderScoreDocOn(tk, doc, { widthPx: 900 });
    const qstamps = timemap.filter((e) => (e.on ?? []).length > 0).map((e) => e.qstamp);
    expect(qstamps[0]).toBe(0);
    expect(qstamps[1]).toBeCloseTo(1 / 3, 6);
    expect(qstamps[2]).toBeCloseTo(1 / 2, 6);
    expect(qstamps[3]).toBeCloseTo(2 / 3, 6);
  });

  it('measures the pickup fixture against Verovio, mRest-free (exp22 H)', () => {
    const doc = pickupAndComplement();
    const { timemap } = renderScoreDocOn(tk, doc, { widthPx: 900 });
    // The first full bar starts one quarter in, not four.
    expect(timemap.find((e) => e.measureOn === doc.measures[1].id)?.qstamp).toBe(1);
  });

  it('renders a measure window and offsets its window-relative timemap from timeline()', () => {
    const doc = windowed();
    const start = doc.measures[4];
    const end = doc.measures[7];
    const { svg, timemap } = renderScoreDocOn(tk, doc, {
      widthPx: 1600,
      measureIds: { start: start.id, end: end.id },
    });
    const rendered = [...svg.matchAll(/<g id="([^"]+)" class="measure"/g)].map((m) => m[1]);
    expect(rendered).toEqual([start.id, doc.measures[5].id, doc.measures[6].id, end.id]);

    // exp22 A: a select-first windowed timemap is window-relative, so its first
    // entry is tstamp 0 no matter where the window sits in the score.
    expect(timemap[0].tstamp).toBe(0);
    expect(timemap[0].qstamp).toBe(0);
    expect(timemap[0].measureOn).toBe(start.id);

    // …and the cursor gets its offset from timeline(), never from Verovio.
    const onset = onsetOf(doc, start.id);
    expect(onset).not.toBeNull();
    const offset = msAt(onset ?? frac(0), quarterBpmOf(doc.tempo));
    expect(offset).toBe(8000);
    expect(offset).toBe(msAtMap(onset ?? frac(0), tempoMap(doc)));
  });

  it('refuses a window that is not a range of this document', () => {
    const doc = windowed();
    expect(() => renderScoreDocOn(tk, doc, { widthPx: 900, measureIds: { start: doc.measures[3].id, end: 'nope' } })).toThrow(
      /not a range/,
    );
    // exp22 D: select() returns 1 for a note-id start and renders the whole
    // score, so a window is verified against the rendered measures, not trusted.
    const noteId = doc.measures[4].staves[0].voices[0].events[0].id;
    expect(() => renderScoreDocOn(tk, doc, { widthPx: 900, measureIds: { start: noteId, end: doc.measures[7].id } })).toThrow();
  });
});
