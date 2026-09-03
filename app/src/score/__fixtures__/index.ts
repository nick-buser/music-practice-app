/**
 * The fixture set every SC1 criterion is measured against.
 *
 * The positive fixtures between them cover the whole v1 model surface —
 * beams, chords, slurs, a hairpin, dynamics, a tie across a barline, a
 * triplet, a key change, a mid-exercise tempo change, a system break, a pickup
 * with its complement, a compound meter, an irregular meter with an explicit
 * grouping, double accidentals in both directions and a cautionary accidental.
 * The negative fixtures are one per refinement, each named for the `IssueCode`
 * it is supposed to trip, so a refinement that stops firing fails a test rather
 * than quietly passing everything.
 */

import { Fx } from './dsl';
import type { ScoreDoc } from '../types';

/* -------------------------------------------------------------------------
 * The main exercise: 8 bars, grand staff, G major → F major at bar 5.
 * ----------------------------------------------------------------------- */

export function grandStaffExercise(): ScoreDoc {
  const f = new Fx(0x5c1a);

  // Bar 1 — four beamed eighths under a slur, then two quarters; mf on beat 1.
  const b1 = [f.n('G4', '8', { fing: 1 }), f.n('A4', '8'), f.n('B4', '8'), f.n('C5', '8'), f.n('D5', '4'), f.n('E5', '4')];
  const m1 = f.m([f.staff(f.v(1, b1)), f.staff(f.v(1, [f.ch('2', ['G2', 'D3']), f.ch('2', ['B2', 'D3'])]))]);
  m1.spanners = [f.slur(b1[0].id, b1[3].id)];
  m1.directions = [f.dyn(b1[0].id, 'mf')];

  // Bar 2 — a 3:2 triplet of eighths, a staccato quarter, then a half tied over the barline.
  const tripletNotes = [f.n('F#5', '8'), f.n('E5', '8'), f.n('D5', '8')];
  const tied = f.n('B4', '2', { tie: 'start' });
  const m2 = f.m([
    f.staff(f.v(1, [f.tup(3, 2, tripletNotes), f.n('C5', '4', { artic: ['staccato'] }), tied])),
    f.staff(f.v(1, [f.n('G2', '4'), f.n('G2', '4'), f.n('G2', '4'), f.n('G2', '4')])),
  ]);

  // Bar 3 — the tie lands here.
  const m3 = f.m([
    f.staff(f.v(1, [f.n('B4', '4', { tie: 'stop' }), f.n('A4', '4'), f.n('G4', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);

  // Bar 4 — eight beamed eighths under a crescendo hairpin.
  const b4 = ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'].map((x) => f.n(x, '8'));
  const m4 = f.m([f.staff(f.v(1, b4)), f.staff(f.v(1, [f.ch('1', ['G2', 'D3'])]))]);
  m4.spanners = [f.hairpin(b4[0].id, b4[7].id, 'cres')];

  // Bar 5 — key change to F major, tempo change, forced system break.
  const b5 = [f.n('F5', '4'), f.n('E5', '4'), f.n('D5', '2')];
  const m5 = f.m([f.staff(f.v(1, b5)), f.staff(f.v(1, [f.n('F2', '2'), f.n('C3', '2')]))], {
    systemBreak: true,
    keySig: { fifths: -1, mode: 'major' },
    tempo: { bpm: 72, unit: { base: 4, dots: 0 }, text: 'Meno mosso' },
  });
  m5.directions = [f.dyn(b5[0].id, 'p')];

  // Bar 6 — the key signature's B flat, unmarked but sounding (accid.ges).
  const m6 = f.m([
    f.staff(f.v(1, [f.n('Bb4', '4'), f.n('A4', '4'), f.n('G4', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);

  // Bar 7 — four beamed sixteenths, then two voices in the left hand.
  const b7 = ['C5', 'D5', 'E5', 'F5'].map((x) => f.n(x, '16'));
  const m7 = f.m([
    f.staff(f.v(1, [...b7, f.n('G5', '4'), f.n('A5', '2')])),
    f.staff(
      f.v(1, [f.n('F3', '2'), f.n('E3', '2')]),
      f.v(2, [f.n('F2', '1')]),
    ),
  ]);

  const m8 = f.m([f.staff(f.v(1, [f.n('F5', '1', { fing: 5 })])), f.staff(f.v(1, [f.n('F2', '1')]))]);

  return f.doc({
    id: '11111111-1111-4111-8111-111111111111',
    meta: { title: 'Grand staff exercise' },
    keySig: { fifths: 1, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 96, unit: { base: 4, dots: 0 }, text: 'Andante' },
    measures: [m1, m2, m3, m4, m5, m6, m7, m8],
  });
}

/* -------------------------------------------------------------------------
 * Pickup + complement.
 * ----------------------------------------------------------------------- */

export function pickupAndComplement(): ScoreDoc {
  const f = new Fx(0x5c1b);
  // A pickup carries explicit rests, never an mRest: Verovio times <mRest> as a
  // full bar even under metcon="false" (`exp22` H).
  const m0 = f.m([f.staff(f.v(1, [f.n('G4', '4')])), f.staff(f.v(1, [f.r('4')]))], { pickup: true });
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C5', '4'), f.n('B4', '4'), f.n('A4', '4'), f.n('G4', '4')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  const m2 = f.m([
    f.staff(f.v(1, [f.n('F4', '4'), f.n('E4', '4'), f.n('D4', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  const m3 = f.m([f.staff(f.v(1, [f.n('C4', '2.')])), f.staff(f.v(1, [f.r('2.')]))], { complement: true });
  return f.doc({
    id: '22222222-2222-4222-8222-222222222222',
    meta: { title: 'Pickup and complement' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 80, unit: { base: 4, dots: 0 } },
    measures: [m0, m1, m2, m3],
  });
}

/* -------------------------------------------------------------------------
 * Compound and irregular meters — the two halves of the beam table.
 * ----------------------------------------------------------------------- */

export function sixEight(): ScoreDoc {
  const f = new Fx(0x5c1c);
  const m1 = f.m([
    f.staff(f.v(1, ['C5', 'D5', 'E5', 'F5', 'G5', 'A5'].map((x) => f.n(x, '8')))),
    f.staff(f.v(1, [f.n('C3', '4.'), f.n('G2', '4.')])),
  ]);
  const m2 = f.m([
    f.staff(f.v(1, [f.n('G5', '4.'), f.n('E5', '8'), f.n('C5', '8'), f.n('G4', '8')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: '33333333-3333-4333-8333-333333333333',
    meta: { title: 'Six eight' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 6, unit: 8 },
    tempo: { bpm: 60, unit: { base: 4, dots: 1 }, text: 'Allegretto' },
    measures: [m1, m2],
  });
}

export function fiveEightGrouped(): ScoreDoc {
  const f = new Fx(0x5c1d);
  const m1 = f.m([
    f.staff(f.v(1, ['C5', 'D5', 'E5', 'F5', 'G5'].map((x) => f.n(x, '8')))),
    f.staff(f.v(1, [f.n('C3', '4'), f.n('G2', '4.')])),
  ]);
  const m2 = f.m([
    f.staff(f.v(1, [f.n('A5', '4'), f.n('G5', '8'), f.n('E5', '8'), f.n('C5', '8')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: '44444444-4444-4444-8444-444444444444',
    meta: { title: 'Five eight' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 5, unit: 8, grouping: [2, 3] },
    tempo: { bpm: 132, unit: { base: 8, dots: 0 } },
    measures: [m1, m2],
  });
}

/* -------------------------------------------------------------------------
 * Spelling: double accidentals and a cautionary, in a sharp key and a flat one.
 * ----------------------------------------------------------------------- */

export function gMajorSpelling(): ScoreDoc {
  const f = new Fx(0x5c1e);
  // F##4 sets F4 to +2 for the bar, so the following F#4 prints a sharp.
  const m1 = f.m([
    f.staff(f.v(1, [f.n('F##4', '4'), f.n('Bbb4', '4'), f.n('F#4', '4'), f.n('C5', '4')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  // A new bar resets to the key signature, so this F#4 would print nothing —
  // which is exactly when `courtesy` is legal (refinement 7).
  const m2 = f.m([
    f.staff(f.v(1, [f.n('F#4', '4', { courtesy: true }), f.n('G4', '4'), f.n('A4', '4'), f.n('B4', '4')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: '55555555-5555-4555-8555-555555555555',
    meta: { title: 'G major spelling' },
    keySig: { fifths: 1, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 60, unit: { base: 4, dots: 0 } },
    measures: [m1, m2],
  });
}

export function fMajorSpelling(): ScoreDoc {
  const f = new Fx(0x5c1f);
  const m1 = f.m([
    f.staff(f.v(1, [f.n('Bbb4', '4'), f.n('F##4', '4'), f.n('B4', '4'), f.n('A4', '4')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  const m2 = f.m([
    f.staff(f.v(1, [f.n('Bb4', '4', { courtesy: true }), f.n('C5', '4'), f.n('D5', '4'), f.n('E5', '4')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: '66666666-6666-4666-8666-666666666666',
    meta: { title: 'F major spelling' },
    keySig: { fifths: -1, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 60, unit: { base: 4, dots: 0 } },
    measures: [m1, m2],
  });
}

/* -------------------------------------------------------------------------
 * A long enough score to window.
 * ----------------------------------------------------------------------- */

export function windowed(): ScoreDoc {
  const f = new Fx(0x5c20);
  const measures = Array.from({ length: 12 }, (_, i) =>
    f.m([
      f.staff(f.v(1, [f.n(`${'CDEFGAB'[i % 7]}5`, '4'), f.n(`${'CDEFGAB'[(i + 2) % 7]}5`, '4'), f.n('G4', '2')])),
      f.staff(f.v(1, [f.n('C3', '1')])),
    ]),
  );
  return f.doc({
    id: '77777777-7777-4777-8777-777777777777',
    meta: { title: 'Windowed' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 120, unit: { base: 4, dots: 0 } },
    measures,
  });
}

/** ♪ ♬ ♪ under 3:2 — legal (refinement 5) and it must time correctly. */
export function unevenTriplet(): ScoreDoc {
  const f = new Fx(0x5c21);
  const m1 = f.m([
    f.staff(
      f.v(1, [
        f.tup(3, 2, [f.n('C5', '8'), f.n('D5', '16'), f.n('E5', '16'), f.n('F5', '8')]),
        f.n('G5', '4'),
        f.n('A5', '2'),
      ]),
    ),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: '88888888-8888-4888-8888-888888888888',
    meta: { title: 'Uneven triplet' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 100, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

/** Every fixture that must serialize, render and validate cleanly. */
export const POSITIVE_FIXTURES: Array<[string, () => ScoreDoc]> = [
  ['grandStaffExercise', grandStaffExercise],
  ['pickupAndComplement', pickupAndComplement],
  ['sixEight', sixEight],
  ['fiveEightGrouped', fiveEightGrouped],
  ['gMajorSpelling', gMajorSpelling],
  ['fMajorSpelling', fMajorSpelling],
  ['windowed', windowed],
  ['unevenTriplet', unevenTriplet],
];

/* -------------------------------------------------------------------------
 * Negative fixtures — one per refinement, each named for the code it trips.
 * Each starts from a valid document and breaks exactly one thing.
 * ----------------------------------------------------------------------- */

function simple(seed: number): { f: Fx; doc: ScoreDoc } {
  const f = new Fx(seed);
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C5', '4'), f.n('D5', '4'), f.n('E5', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  const m2 = f.m([
    f.staff(f.v(1, [f.n('F5', '4'), f.n('G5', '4'), f.n('A5', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  const doc = f.doc({
    id: '99999999-9999-4999-8999-999999999999',
    meta: { title: 'Simple' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1, m2],
  });
  return { f, doc };
}

/** A valid two-bar C major document — the base every negative fixture mutates. */
export function simpleValid(): ScoreDoc {
  return simple(0x5c30).doc;
}

export function overfullVoice(): ScoreDoc {
  const { f, doc } = simple(0x5c31);
  doc.measures[0].staves[0].voices[0].events.push(f.n('B5', '4'));
  return doc;
}

export function underfullVoice(): ScoreDoc {
  const { doc } = simple(0x5c32);
  doc.measures[0].staves[0].voices[0].events.pop();
  return doc;
}

export function danglingTie(): ScoreDoc {
  const { doc } = simple(0x5c33);
  // A tie whose following event is a different pitch.
  (doc.measures[0].staves[0].voices[0].events[0] as { tie?: string }).tie = 'start';
  return doc;
}

export function orphanTieStop(): ScoreDoc {
  const { doc } = simple(0x5c34);
  (doc.measures[0].staves[0].voices[0].events[1] as { tie?: string }).tie = 'stop';
  return doc;
}

export function duplicateId(): ScoreDoc {
  const { doc } = simple(0x5c35);
  const v = doc.measures[0].staves[0].voices[0];
  v.events[1].id = v.events[0].id;
  return doc;
}

export function measureRestInPickup(): ScoreDoc {
  const f = new Fx(0x5c36);
  const m0 = f.m([f.staff(f.v(1, [f.n('G4', '4')])), f.staff(f.v(1, [f.mr()]))], { pickup: true });
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C5', '4'), f.n('D5', '4'), f.n('E5', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    meta: { title: 'mRest in a pickup' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m0, m1],
  });
}

export function initialStateOnMeasureZero(): ScoreDoc {
  const { doc } = simple(0x5c37);
  doc.measures[0].tempo = { bpm: 120, unit: { base: 4, dots: 0 } };
  return doc;
}

export function courtesyRedundant(): ScoreDoc {
  const f = new Fx(0x5c38);
  // C#5 already prints a sharp in C major, so `courtesy` is redundant.
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C#5', '4', { courtesy: true }), f.n('D5', '4'), f.n('E5', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    meta: { title: 'Redundant courtesy' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

export function sameEndpointHairpin(): ScoreDoc {
  const { f, doc } = simple(0x5c39);
  const first = doc.measures[0].staves[0].voices[0].events[0].id;
  doc.measures[0].spanners = [f.hairpin(first, first, 'cres')];
  return doc;
}

export function spannerInWrongMeasure(): ScoreDoc {
  const { f, doc } = simple(0x5c3a);
  const a = doc.measures[0].staves[0].voices[0].events[0].id;
  const b = doc.measures[0].staves[0].voices[0].events[1].id;
  doc.measures[1].spanners = [f.slur(a, b)];
  return doc;
}

export function endpointOnRest(): ScoreDoc {
  const f = new Fx(0x5c3b);
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C5', '4'), f.r('4'), f.n('E5', '2')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  const rest = m1.staves[0].voices[0].events[1].id;
  m1.spanners = [f.slur(m1.staves[0].voices[0].events[0].id, rest)];
  return f.doc({
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    meta: { title: 'Endpoint on a rest' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

export function meterOutsideSet(): ScoreDoc {
  const f = new Fx(0x5c3c);
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C5', '4'), f.n('D5', '4'), f.n('E5', '4'), f.n('F5', '4'), f.n('G5', '4'), f.n('A5', '4'), f.n('B5', '4')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    meta: { title: 'Seven four' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 7, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

export function tupletBadRatio(): ScoreDoc {
  const f = new Fx(0x5c3d);
  // Two eighths under a 3:2 ratio: 1 quarter of nominal duration, and 1/3 is
  // not a power of two, so the tuplet cannot be notated.
  const m1 = f.m([
    f.staff(f.v(1, [f.tup(3, 2, [f.n('C5', '8'), f.n('D5', '8')]), f.n('E5', '2'), f.n('F5', '4'), f.n('G5', '8'), f.n('A5', '8')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    meta: { title: 'Bad tuplet ratio' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

export function chordNotAscending(): ScoreDoc {
  const f = new Fx(0x5c3e);
  const m1 = f.m([
    // C#5 and Db5 are the same sounding pitch — an enharmonic pair, not a chord.
    f.staff(f.v(1, [f.ch('1', ['C#5', 'Db5'])])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    meta: { title: 'Enharmonic chord' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

export function outOfRange(): ScoreDoc {
  const f = new Fx(0x5c3f);
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C0', '1')])),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: '10101010-1010-4010-8010-101010101010',
    meta: { title: 'Below the piano' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

export function mrestNotAlone(): ScoreDoc {
  const f = new Fx(0x5c40);
  const m1 = f.m([
    f.staff(f.v(1, [f.n('C5', '4'), f.n('D5', '4'), f.n('E5', '2')])),
    f.staff(f.v(1, [f.mr(), f.n('C3', '4')])),
  ]);
  return f.doc({
    id: '20202020-2020-4020-8020-202020202020',
    meta: { title: 'mRest with company' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 4, unit: 4 },
    tempo: { bpm: 90, unit: { base: 4, dots: 0 } },
    measures: [m1],
  });
}

export function systemBreakOnFirstMeasure(): ScoreDoc {
  const { doc } = simple(0x5c41);
  doc.measures[0].systemBreak = true;
  return doc;
}

export function timeSigGroupingMissing(): ScoreDoc {
  const f = new Fx(0x5c42);
  const m1 = f.m([
    f.staff(f.v(1, ['C5', 'D5', 'E5', 'F5', 'G5'].map((x) => f.n(x, '8')))),
    f.staff(f.v(1, [f.mr()])),
  ]);
  return f.doc({
    id: '30303030-3030-4030-8030-303030303030',
    meta: { title: 'Five eight without a grouping' },
    keySig: { fifths: 0, mode: 'major' },
    timeSig: { count: 5, unit: 8 },
    tempo: { bpm: 120, unit: { base: 8, dots: 0 } },
    measures: [m1],
  });
}

export function timeSigBadSym(): ScoreDoc {
  const { doc } = simple(0x5c43);
  doc.timeSig = { count: 4, unit: 4, sym: 'cut' };
  return doc;
}

/**
 * Structural negatives — these fail `ScoreDocSchema.safeParse`, so they are
 * built as plain blobs rather than through the DSL, which is typed.
 */
export function nestedTuplet(): unknown {
  const doc = simpleValid() as unknown as Record<string, unknown>;
  const measures = doc.measures as Array<Record<string, unknown>>;
  const voices = (measures[0].staves as Array<{ voices: Array<{ events: unknown[] }> }>)[0].voices;
  voices[0].events = [
    {
      kind: 'tuplet',
      id: 't0000000000',
      num: 3,
      numbase: 2,
      events: [{ kind: 'tuplet', id: 't1111111111', num: 3, numbase: 2, events: [] }],
    },
  ];
  return doc;
}

export function oneNoteChord(): unknown {
  const doc = simpleValid() as unknown as Record<string, unknown>;
  const measures = doc.measures as Array<Record<string, unknown>>;
  const voices = (measures[0].staves as Array<{ voices: Array<{ events: unknown[] }> }>)[0].voices;
  voices[0].events = [
    { kind: 'chord', id: 'c000000000a', duration: { base: 1, dots: 0 }, notes: [{ id: 'n000000000a', pitch: { step: 'C', alter: 0, octave: 5 } }] },
  ];
  return doc;
}

export function wrongStaffCount(): unknown {
  const doc = simpleValid() as unknown as { staves: unknown[] };
  doc.staves = [doc.staves[0]];
  return doc;
}

export function digitLeadingId(): unknown {
  const doc = simpleValid() as unknown as Record<string, unknown>;
  const measures = doc.measures as Array<{ id: string }>;
  measures[0].id = '1abcdefghij';
  return doc;
}

/** A stored id that is a legal NCName but not the stored shape — refinement 1. */
export function badStoredIdShape(): unknown {
  const doc = simpleValid() as unknown as Record<string, unknown>;
  const measures = doc.measures as Array<{ id: string }>;
  measures[0].id = 'mABCDEFGHIJ';
  return doc;
}
