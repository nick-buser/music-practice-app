// @vitest-environment node
// The Verovio WASM toolkit loads under node, not jsdom (docs/probes/verovio
// all run under node). A per-file docblock keeps every other suite on jsdom.
import { beforeAll, describe, expect, it } from 'vitest';
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';

import { fMajorSpelling, gMajorSpelling, grandStaffExercise } from './__fixtures__';
import {
  accidentalState,
  gesturalAccidental,
  keySigAlterations,
  midiOf,
  spellMidi,
  transposePitch,
  writtenAccidental,
} from './pitch';
import { renderScoreDocOn } from '../verovio/toolkit';
import type { ChordNote, Note, ScoreDoc, SpelledPitch } from './types';

const P = (step: SpelledPitch['step'], alter: SpelledPitch['alter'], octave: number): SpelledPitch => ({
  step,
  alter,
  octave,
});

describe('midiOf', () => {
  it('puts middle C at 60', () => {
    expect(midiOf(P('C', 0, 4))).toBe(60);
    expect(midiOf(P('A', 0, 4))).toBe(69);
    expect(midiOf(P('A', 0, 0))).toBe(21);
    expect(midiOf(P('C', 0, 8))).toBe(108);
  });

  it('counts the alteration, double accidentals included', () => {
    expect(midiOf(P('F', 1, 4))).toBe(66);
    expect(midiOf(P('F', 2, 4))).toBe(67);
    expect(midiOf(P('B', -2, 4))).toBe(69);
    expect(midiOf(P('C', -1, 4))).toBe(59);
    expect(midiOf(P('B', 1, 3))).toBe(60); // B#3 and C4 are the same sound
  });
});

describe('accidental vocabulary', () => {
  it('maps alter to the written value, x included', () => {
    expect([-2, -1, 0, 1, 2].map(writtenAccidental)).toEqual(['ff', 'f', 'n', 's', 'x']);
  });

  it('maps alter to the gestural value — ss, never x (exp22 C)', () => {
    expect([-2, -1, 1, 2].map(gesturalAccidental)).toEqual(['ff', 'f', 's', 'ss']);
    expect(gesturalAccidental(0)).toBeNull();
  });
});

describe('keySigAlterations', () => {
  it('adds sharps in F C G D A E B order', () => {
    expect(keySigAlterations({ fifths: 1, mode: 'major' })).toMatchObject({ F: 1, C: 0 });
    expect(keySigAlterations({ fifths: 3, mode: 'major' })).toMatchObject({ F: 1, C: 1, G: 1, D: 0 });
    expect(Object.values(keySigAlterations({ fifths: 7, mode: 'major' }))).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('adds flats in B E A D G C F order', () => {
    expect(keySigAlterations({ fifths: -1, mode: 'major' })).toMatchObject({ B: -1, E: 0 });
    expect(keySigAlterations({ fifths: -4, mode: 'minor' })).toMatchObject({ B: -1, E: -1, A: -1, D: -1, G: 0 });
  });
});

describe('spellMidi', () => {
  const C = { fifths: 0, mode: 'major' } as const;
  const G = { fifths: 1, mode: 'major' } as const;

  it('returns the diatonic spelling for a diatonic pitch', () => {
    expect(spellMidi(60, C, 'sharp')).toEqual(P('C', 0, 4));
    expect(spellMidi(66, G, 'sharp')).toEqual(P('F', 1, 4));
    expect(spellMidi(66, G, 'flat')).toEqual(P('F', 1, 4));
  });

  it('raises the letter below for sharp and lowers the one above for flat', () => {
    expect(spellMidi(61, C, 'sharp')).toEqual(P('C', 1, 4));
    expect(spellMidi(61, C, 'flat')).toEqual(P('D', -1, 4));
    expect(spellMidi(70, C, 'sharp')).toEqual(P('A', 1, 4));
    expect(spellMidi(70, C, 'flat')).toEqual(P('B', -1, 4));
  });

  it('never produces a double accidental, even in a seven-sharp key', () => {
    const cSharp = { fifths: 7, mode: 'major' } as const;
    for (let midi = 21; midi <= 108; midi += 1) {
      for (const prefer of ['sharp', 'flat'] as const) {
        const spelled = spellMidi(midi, cSharp, prefer);
        expect(Math.abs(spelled.alter), `${midi} ${prefer}`).toBeLessThanOrEqual(1);
        expect(midiOf(spelled)).toBe(midi);
      }
    }
  });

  it('round-trips every MIDI value in every key signature', () => {
    for (let fifths = -7; fifths <= 7; fifths += 1) {
      const key = { fifths, mode: 'major' } as const;
      for (let midi = 21; midi <= 108; midi += 1) {
        expect(midiOf(spellMidi(midi, key as never, 'sharp'))).toBe(midi);
        expect(midiOf(spellMidi(midi, key as never, 'flat'))).toBe(midi);
      }
    }
  });
});

describe('transposePitch', () => {
  const C = { fifths: 0, mode: 'major' } as const;
  const G = { fifths: 1, mode: 'major' } as const;

  it('moves a diatonic note by letter inside the key', () => {
    // A third up from C in C major is E, not D##.
    expect(transposePitch(P('C', 0, 4), 4, C)).toEqual(P('E', 0, 4));
    // A third up from D is F — a minor third, because the key says so.
    expect(transposePitch(P('D', 0, 4), 3, C)).toEqual(P('F', 0, 4));
    // In G major the same move from E lands on G, and from A on C.
    expect(transposePitch(P('E', 0, 4), 3, G)).toEqual(P('G', 0, 4));
    expect(transposePitch(P('F', 1, 4), 3, G)).toEqual(P('A', 0, 4));
  });

  it('crosses octaves', () => {
    expect(transposePitch(P('B', 0, 4), 1, C)).toEqual(P('C', 0, 5));
    expect(transposePitch(P('C', 0, 4), -1, C)).toEqual(P('B', 0, 3));
  });

  it('falls back to spellMidi for a chromatic move, sharpwards up and flatwards down', () => {
    expect(transposePitch(P('C', 0, 4), 1, C)).toEqual(P('C', 1, 4));
    expect(transposePitch(P('C', 0, 4), -1, C)).toEqual(P('B', 0, 3));
    expect(transposePitch(P('E', 0, 4), -2, C)).toEqual(P('D', 0, 4));
    expect(transposePitch(P('C', 1, 4), 1, C)).toEqual(P('D', 0, 4));
  });

  it('always lands on the requested sounding pitch', () => {
    for (const semis of [-12, -7, -3, -1, 1, 2, 5, 12]) {
      expect(midiOf(transposePitch(P('F', 1, 4), semis, G))).toBe(66 + semis);
    }
  });
});

describe('accidentalState', () => {
  it('prints nothing for a note the key signature already covers', () => {
    const doc = grandStaffExercise();
    const tuplet = doc.measures[1].staves[0].voices[0].events[0];
    if (tuplet.kind !== 'tuplet') throw new Error('fixture drift');
    const fSharp = tuplet.events[0];
    const decision = accidentalState(doc).get(fSharp.id);
    expect(decision).toEqual({ written: null, gestural: 's' });
  });

  it('prints an accidental when the alteration in force differs, and keeps it in force', () => {
    const doc = gMajorSpelling();
    const [fx, bbb, fSharp] = doc.measures[0].staves[0].voices[0].events as Note[];
    const state = accidentalState(doc);
    expect(state.get(fx.id)).toEqual({ written: 'x', gestural: 'ss' });
    expect(state.get(bbb.id)).toEqual({ written: 'ff', gestural: 'ff' });
    // F4 is in force at +2 after the double sharp, so the plain F# reprints.
    expect(state.get(fSharp.id)).toEqual({ written: 's', gestural: 's' });
  });

  it('resets at the barline, which is what makes the cautionary legal', () => {
    const doc = gMajorSpelling();
    const courtesy = doc.measures[1].staves[0].voices[0].events[0] as Note;
    expect(accidentalState(doc).get(courtesy.id)).toEqual({ written: null, gestural: 's' });
  });

  it('prints a natural against a flat key signature', () => {
    const doc = fMajorSpelling();
    const natural = doc.measures[0].staves[0].voices[0].events[2] as Note;
    expect(accidentalState(doc).get(natural.id)).toEqual({ written: 'n', gestural: null });
  });

  it('prints nothing on a tie-stop and keeps the chain alteration across the barline', () => {
    const doc = grandStaffExercise();
    const stop = doc.measures[2].staves[0].voices[0].events[0] as Note;
    expect(stop.tie).toBe('stop');
    expect(accidentalState(doc).get(stop.id)).toEqual({ written: null, gestural: null });
  });
});

/* -------------------------------------------------------------------------
 * The criterion: what Verovio actually sounds.
 * ----------------------------------------------------------------------- */

function allNotes(doc: ScoreDoc): Array<Note | ChordNote> {
  const out: Array<Note | ChordNote> = [];
  for (const m of doc.measures) {
    for (const st of m.staves) {
      for (const v of st.voices) {
        const walk = (events: ReadonlyArray<{ kind: string }>): void => {
          for (const e of events as Array<Note | { kind: string; notes?: ChordNote[]; events?: Note[] }>) {
            if (e.kind === 'note') out.push(e as Note);
            if (e.kind === 'chord') out.push(...((e as { notes: ChordNote[] }).notes));
            if (e.kind === 'tuplet') walk((e as { events: Note[] }).events);
          }
        };
        walk(v.events);
      }
    }
  }
  return out;
}

describe('sounding pitch through Verovio (exp12: no key signature is applied)', () => {
  let tk: VerovioToolkit;

  beforeAll(async () => {
    tk = new VerovioToolkit(await createVerovioModule());
  });

  it.each([
    ['G major', gMajorSpelling],
    ['F major', fMajorSpelling],
  ])('%s: every note sounds midiOf(pitch)', (_name, make) => {
    const doc = make();
    renderScoreDocOn(tk, doc, { widthPx: 900 });
    for (const note of allNotes(doc)) {
      expect(tk.getMIDIValuesForElement(note.id).pitch, `${note.id}`).toBe(midiOf(note.pitch));
    }
  });

  it('sounds the whole exercise, including tied and key-signature notes', () => {
    const doc = grandStaffExercise();
    renderScoreDocOn(tk, doc, { widthPx: 1600 });
    for (const note of allNotes(doc)) {
      expect(tk.getMIDIValuesForElement(note.id).pitch, `${note.id}`).toBe(midiOf(note.pitch));
    }
  });

  it.each([
    ['G major', gMajorSpelling],
    ['F major', fMajorSpelling],
  ])('%s: the cautionary note draws exactly two parens and one accid group of ours', (_name, make) => {
    const doc = make();
    const { svg } = renderScoreDocOn(tk, doc, { widthPx: 900 });
    const courtesy = doc.measures[1].staves[0].voices[0].events[0];
    // E26A/E26B are the SMuFL parentheses; `enclose="paren"` is what draws them
    // (`exp22` B: func="caution" alone drew none).
    expect((svg.match(/href="#E26[AB]-/g) ?? []).length).toBe(2);
    expect((svg.match(new RegExp(`<g id="${courtesy.id}-acc" class="accid"`, 'g')) ?? []).length).toBe(1);
    // And no second accid group on the note itself (`exp22` B, noteGesPlusChild).
    expect(svg).not.toContain(`<g id="${courtesy.id}" class="accid"`);
  });
});
