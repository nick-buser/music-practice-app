/**
 * Pitch: sounding value, spelling, and the accidental walk.
 *
 * The load-bearing fact here is measured, not assumed (`exp12`): **Verovio
 * applies no key signature and no bar carry-over to sounding pitch.** An
 * unmarked `f` in G major sounds 65, not 66; a plain `c` after a `c♯` in the
 * same bar sounds 72, not 73. Assessment compares MIDI against
 * `midiOf(note.pitch)`, so every altered note must carry `@accid.ges`
 * regardless of whether an accidental is *printed* — that is why
 * `accidentalState()` returns a written decision and a gestural value
 * separately, and why the gestural one depends only on `alter`.
 *
 * The gestural vocabulary is `s | ss | f | ff`, never `x`: 4.5.1 rejects
 * `accid.ges="x"` with "Unsupported value 'x' for data.ACCIDENTAL.GESTURAL"
 * and sounds the note unaltered (`exp22` C — `accid.ges="x"` gave 65 where
 * `accid.ges="ss"` gave 67).
 *
 * TODO(SR1): the key/spelling tables below move to `theory/keys.ts` when SR1
 * extracts them; this is the private copy the ticket sanctions until then.
 */

import { effectiveAttrsByMeasure } from './attrs';
import { add, cmp, durationOf, ZERO } from './fraction';
import type {
  Chord,
  ChordNote,
  ElementId,
  Fraction,
  KeySig,
  Note,
  Rest,
  ScoreDoc,
  SpelledPitch,
  TieRole,
} from './types';

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
type Step = (typeof STEPS)[number];

/** Semitone of each natural letter above C. */
const STEP_PC: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Order the sharps and flats are added in a key signature. */
const SHARP_ORDER: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** MEI written `@accid` (a natural is a written accidental; `x` is legal here). */
export type WrittenAccidental = 'ff' | 'f' | 'n' | 's' | 'x';
/** MEI gestural `@accid.ges`. `x` is NOT in this vocabulary (`exp22` C). */
export type GesturalAccidental = 'ff' | 'f' | 's' | 'ss';

const WRITTEN_BY_ALTER: Record<number, WrittenAccidental> = { [-2]: 'ff', [-1]: 'f', 0: 'n', 1: 's', 2: 'x' };
const GESTURAL_BY_ALTER: Record<number, GesturalAccidental> = { [-2]: 'ff', [-1]: 'f', 1: 's', 2: 'ss' };

export function writtenAccidental(alter: number): WrittenAccidental {
  const v = WRITTEN_BY_ALTER[alter];
  if (!v) throw new Error(`no written accidental for alter ${alter}`);
  return v;
}

/** `null` for `alter === 0` — an unaltered note needs no gestural attribute. */
export function gesturalAccidental(alter: number): GesturalAccidental | null {
  return GESTURAL_BY_ALTER[alter] ?? null;
}

/** `12 × (octave + 1) + pc(step) + alter`. C4 = 60. */
export function midiOf(p: SpelledPitch): number {
  return 12 * (p.octave + 1) + STEP_PC[p.step as Step] + p.alter;
}

/** The alteration a key signature puts on each letter: −1, 0 or +1. */
export function keySigAlterations(keySig: KeySig): Record<Step, -1 | 0 | 1> {
  const out: Record<Step, -1 | 0 | 1> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  const n = Math.abs(keySig.fifths);
  const order = keySig.fifths >= 0 ? SHARP_ORDER : FLAT_ORDER;
  const sign = keySig.fifths >= 0 ? 1 : -1;
  for (let i = 0; i < n; i += 1) out[order[i]] = sign as -1 | 1;
  return out;
}

/* -------------------------------------------------------------------------
 * Spelling (§Editing, item 8). One owner: step entry, the MIDI importer, the
 * generator's legality pass and the transpose command all call these.
 * ----------------------------------------------------------------------- */

/** Chromatic fallbacks that never need a double accidental. */
const SHARP_TABLE: Array<[Step, -1 | 0 | 1]> = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];
const FLAT_TABLE: Array<[Step, -1 | 0 | 1]> = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
];

function pitchAt(midi: number, step: Step, alter: -2 | -1 | 0 | 1 | 2): SpelledPitch {
  const octave = (midi - alter - STEP_PC[step]) / 12 - 1;
  return { step, alter, octave };
}

/**
 * Spell a MIDI number in a key. Diatonic notes get their diatonic spelling;
 * everything else is the nearest diatonic letter below raised by one
 * (`'sharp'`) or the nearest above lowered by one (`'flat'`). A double
 * accidental is never produced: in a key whose signature already alters the
 * neighbouring letter the literal rule would ask for one, and the plain
 * chromatic table is used instead. Callers wanting a double accidental build
 * the `SpelledPitch` themselves.
 */
export function spellMidi(midi: number, keySig: KeySig, prefer: 'sharp' | 'flat'): SpelledPitch {
  const alt = keySigAlterations(keySig);
  const pc = ((midi % 12) + 12) % 12;
  for (const step of STEPS) {
    if (((STEP_PC[step] + alt[step]) % 12 + 12) % 12 === pc) return pitchAt(midi, step, alt[step]);
  }
  const neighbourPc = prefer === 'sharp' ? (pc + 11) % 12 : (pc + 1) % 12;
  for (const step of STEPS) {
    if (((STEP_PC[step] + alt[step]) % 12 + 12) % 12 === neighbourPc) {
      const alter = alt[step] + (prefer === 'sharp' ? 1 : -1);
      if (Math.abs(alter) <= 1) return pitchAt(midi, step, alter as -1 | 0 | 1);
    }
  }
  const [step, alter] = (prefer === 'sharp' ? SHARP_TABLE : FLAT_TABLE)[pc];
  return pitchAt(midi, step, alter);
}

/**
 * Move by semitones and re-spell. A diatonic move inside the key keeps the
 * letter arithmetic (so a third up from a scale degree lands on the letter a
 * third away, whatever accidentals the key puts on it); anything else falls
 * back to `spellMidi`, sharpwards going up and flatwards going down.
 */
export function transposePitch(pitch: SpelledPitch, semitones: number, keySig: KeySig): SpelledPitch {
  const target = midiOf(pitch) + semitones;
  const alt = keySigAlterations(keySig);
  const isDiatonic = alt[pitch.step as Step] === pitch.alter;
  if (isDiatonic) {
    const from = STEPS.indexOf(pitch.step as Step);
    for (let k = -14; k <= 14; k += 1) {
      const idx = from + k;
      const step = STEPS[((idx % 7) + 7) % 7];
      const octave = pitch.octave + Math.floor(idx / 7);
      const candidate: SpelledPitch = { step, alter: alt[step], octave };
      if (midiOf(candidate) === target) return candidate;
    }
  }
  return spellMidi(target, keySig, semitones >= 0 ? 'sharp' : 'flat');
}

/* -------------------------------------------------------------------------
 * The accidental walk.
 * ----------------------------------------------------------------------- */

export interface AccidentalDecision {
  /** The `@accid` to print, or `null` when the alteration is already in force. */
  written: WrittenAccidental | null;
  /** `@accid.ges`, present whenever `alter ≠ 0`, printed or not (`exp12`). */
  gestural: GesturalAccidental | null;
}

interface WalkNote {
  id: ElementId;
  pitch: SpelledPitch;
  tie?: TieRole;
}

interface WalkEntry {
  onset: Fraction;
  voiceN: number;
  notes: WalkNote[];
  /** True when this event is the last of its voice in the measure — its ties cross the barline. */
  last: boolean;
}

function notesOf(e: Note | Chord | Rest): WalkNote[] {
  if (e.kind === 'note') return [{ id: e.id, pitch: e.pitch, tie: e.tie }];
  if (e.kind === 'chord') return e.notes.map((n: ChordNote) => ({ id: n.id, pitch: n.pitch, tie: n.tie }));
  return [];
}

const key = (p: SpelledPitch): string => `${p.step}${p.octave}`;

/**
 * Decide, for every notehead in the document, what accidental is printed and
 * what gestural alteration is emitted.
 *
 * Per staff per measure the two voices are merged by onset (a chord's notes
 * together, voice 1 before voice 2 at the same onset) and walked in score-time
 * order, keeping per (letter, octave) the alteration in force: initially the
 * key signature's, replaced by each written accidental. A note prints an
 * accidental — a natural when `alter === 0` — iff its `alter` differs from
 * what is in force. A tie-stop prints nothing and changes nothing; a tie
 * crossing the barline seeds the next measure's state for that (letter,
 * octave) so the chain's alteration stays in force.
 *
 * The scorer imports this same function, so the engraving and the expected
 * pitches can never disagree.
 */
export function accidentalState(doc: ScoreDoc): Map<ElementId, AccidentalDecision> {
  const out = new Map<ElementId, AccidentalDecision>();
  const attrs = effectiveAttrsByMeasure(doc);
  // Per staff: (letter, octave) → alteration carried across the coming barline.
  let carry: Array<Map<string, number>> = doc.staves.map(() => new Map());

  doc.measures.forEach((measure, mi) => {
    const alterations = keySigAlterations(attrs[mi].keySig);
    const nextCarry: Array<Map<string, number>> = doc.staves.map(() => new Map());

    measure.staves.forEach((staff, si) => {
      const state = new Map<string, number>();
      const entries: WalkEntry[] = [];
      for (const voice of staff.voices) {
        let onset = ZERO;
        voice.events.forEach((e, ei) => {
          const isLast = ei === voice.events.length - 1;
          if (e.kind === 'tuplet') {
            const ratio = { num: e.num, numbase: e.numbase };
            e.events.forEach((te, ti) => {
              entries.push({
                onset,
                voiceN: voice.n,
                notes: notesOf(te),
                last: isLast && ti === e.events.length - 1,
              });
              onset = add(onset, durationOf(te.duration, ratio));
            });
            return;
          }
          if (e.kind === 'measureRest') {
            entries.push({ onset, voiceN: voice.n, notes: [], last: isLast });
            return;
          }
          entries.push({ onset, voiceN: voice.n, notes: notesOf(e), last: isLast });
          onset = add(onset, durationOf(e.duration));
        });
      }
      entries.sort((a, b) => cmp(a.onset, b.onset) || a.voiceN - b.voiceN);

      const inForce = (p: SpelledPitch): number => {
        const k = key(p);
        if (state.has(k)) return state.get(k) as number;
        const carried = carry[si].get(k);
        return carried ?? alterations[p.step as Step];
      };

      for (const entry of entries) {
        for (const n of entry.notes) {
          const gestural = gesturalAccidental(n.pitch.alter);
          if (n.tie === 'stop' || n.tie === 'both') {
            // A tie-stop prints nothing and changes nothing (§Rules).
            out.set(n.id, { written: null, gestural });
          } else {
            const current = inForce(n.pitch);
            const prints = current !== n.pitch.alter;
            out.set(n.id, { written: prints ? writtenAccidental(n.pitch.alter) : null, gestural });
            if (prints) state.set(key(n.pitch), n.pitch.alter);
          }
          if (entry.last && (n.tie === 'start' || n.tie === 'both')) {
            nextCarry[si].set(key(n.pitch), n.pitch.alter);
          }
        }
      }
    });

    carry = nextCarry;
  });

  return out;
}
