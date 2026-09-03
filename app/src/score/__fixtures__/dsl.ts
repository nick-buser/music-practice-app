/**
 * A tiny builder for ScoreDoc fixtures.
 *
 * Fixtures are read far more often than they are written — they are the
 * evidence for the MEI and SVG snapshots, so a reader has to be able to see
 * the *music* in them. Written out as literal objects, eight bars of grand
 * staff is several hundred lines of `{ kind: 'note', id: …, pitch: { step:
 * 'G', alter: 0, octave: 4 }, duration: { base: 8, dots: 0 } }` and nobody can
 * tell whether the bar is full.
 *
 * Ids come from a seeded `IdSource`, so every fixture's ids are fixed for as
 * long as its events are — which is what makes a committed MEI snapshot
 * meaningful rather than a re-record-on-every-run ritual.
 */

import { seededIdSource } from '../ids';
import type {
  Articulation,
  Chord,
  ChordNote,
  Direction,
  Duration,
  Finger,
  Measure,
  MeasureRest,
  MeasureStaff,
  Note,
  Rest,
  ScoreDoc,
  ScoreMeta,
  Spanner,
  SpelledPitch,
  TieRole,
  TupletGroup,
  Voice,
} from '../types';

/** mulberry32 — a small, fast, fully deterministic PRNG with no dependency. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PITCH_RE = /^([A-G])(#{1,2}|b{1,2})?(-?\d)$/;

/** `"F##4"`, `"Bb3"`, `"C4"`. */
export function p(spec: string): SpelledPitch {
  const m = PITCH_RE.exec(spec);
  if (!m) throw new Error(`bad pitch "${spec}"`);
  const alter = m[2] === undefined ? 0 : m[2][0] === '#' ? m[2].length : -m[2].length;
  return { step: m[1] as SpelledPitch['step'], alter: alter as SpelledPitch['alter'], octave: Number(m[3]) };
}

const DUR_RE = /^(1|2|4|8|16|32)(\.{0,2})$/;

/** `"4"`, `"8."`, `"2.."`. */
export function d(spec: string): Duration {
  const m = DUR_RE.exec(spec);
  if (!m) throw new Error(`bad duration "${spec}"`);
  return { base: Number(m[1]) as Duration['base'], dots: m[2].length as Duration['dots'] };
}

export interface NoteOpts {
  tie?: TieRole;
  courtesy?: true;
  artic?: Articulation[];
  fing?: Finger;
}

export class Fx {
  private readonly ids: ReturnType<typeof seededIdSource>;

  constructor(seed: number) {
    this.ids = seededIdSource(mulberry32(seed));
  }

  id(kind: Parameters<ReturnType<typeof seededIdSource>['next']>[0]): string {
    return this.ids.next(kind);
  }

  n(pitch: string, dur: string, opts: NoteOpts = {}): Note {
    return {
      kind: 'note',
      id: this.id('note'),
      pitch: p(pitch),
      duration: d(dur),
      ...(opts.tie ? { tie: opts.tie } : {}),
      ...(opts.courtesy ? { courtesy: true as const } : {}),
      ...(opts.artic ? { articulations: opts.artic } : {}),
      ...(opts.fing ? { fingering: opts.fing } : {}),
    };
  }

  cn(pitch: string, opts: NoteOpts = {}): ChordNote {
    return {
      id: this.id('note'),
      pitch: p(pitch),
      ...(opts.tie ? { tie: opts.tie } : {}),
      ...(opts.courtesy ? { courtesy: true as const } : {}),
      ...(opts.fing ? { fingering: opts.fing } : {}),
    };
  }

  ch(dur: string, pitches: string[], opts: { artic?: Articulation[] } = {}): Chord {
    return {
      kind: 'chord',
      id: this.id('chord'),
      duration: d(dur),
      notes: pitches.map((x) => this.cn(x)),
      ...(opts.artic ? { articulations: opts.artic } : {}),
    };
  }

  r(dur: string): Rest {
    return { kind: 'rest', id: this.id('rest'), duration: d(dur) };
  }

  mr(): MeasureRest {
    return { kind: 'measureRest', id: this.id('measureRest') };
  }

  tup(num: number, numbase: number, events: Array<Note | Chord | Rest>): TupletGroup {
    return { kind: 'tuplet', id: this.id('tuplet'), num, numbase, events };
  }

  v(n: 1 | 2, events: Voice['events']): Voice {
    return { id: this.id('voice'), n, events };
  }

  staff(...voices: Voice[]): MeasureStaff {
    return { voices };
  }

  slur(startId: string, endId: string): Spanner {
    return { kind: 'slur', id: this.id('slur'), startId, endId };
  }

  hairpin(startId: string, endId: string, form: 'cres' | 'dim'): Spanner {
    return { kind: 'hairpin', id: this.id('hairpin'), startId, endId, form };
  }

  dyn(at: string, value: Direction['value']): Direction {
    return { kind: 'dynamic', id: this.id('dynamic'), at, value };
  }

  m(staves: MeasureStaff[], extra: Omit<Partial<Measure>, 'id' | 'staves'> = {}): Measure {
    return { id: this.id('measure'), staves, spanners: [], directions: [], ...extra };
  }

  doc(
    args: Omit<ScoreDoc, 'schemaVersion' | 'id' | 'revision' | 'meta' | 'staves'> & {
      id: string;
      meta?: Partial<ScoreMeta>;
    },
  ): ScoreDoc {
    const { id, meta, ...rest } = args;
    return {
      schemaVersion: 1,
      id,
      revision: 1,
      meta: { title: 'fixture', source: 'authored', ...meta } as ScoreMeta,
      staves: [
        { id: this.id('staffDef'), clef: 'treble', hand: 'rh' },
        { id: this.id('staffDef'), clef: 'bass', hand: 'lh' },
      ],
      ...rest,
    };
  }
}
