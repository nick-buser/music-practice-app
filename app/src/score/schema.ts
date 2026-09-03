/**
 * The zod schema and the semantic refinements — the *only* gate on a ScoreDoc.
 *
 * This module exists because of one measured fact: **Verovio validates
 * nothing.** An overfull bar, a missing staff, a note with no duration, a
 * tuplet without a ratio, duplicate `xml:id`s, a bad pitch name and an unknown
 * element all return `loadData → 1` with an empty `getLog()` (`exp19`,
 * `exp08`); every warning goes to the console, and 4.5.1's JS toolkit has no
 * log-level API to capture it. An overfull bar does not fail — it renders, and
 * silently shifts every later onset. So nothing downstream can detect a
 * malformed document, and `validateScoreDoc` has to.
 *
 * The split between `ScoreDocSchema` and the refinements is deliberate:
 * structure (shapes, enums, cardinalities, id syntax) is zod and reports as one
 * `code: 'schema'` issue carrying the zod path; everything that needs to *look
 * at the music* — durations against the meter, tie pairing, accidental
 * redundancy, spanner ordering — is a refinement with its own `IssueCode`, and
 * runs only on a structurally valid document.
 */

import { z } from 'zod';

import { effectiveAttrsByMeasure } from './attrs';
import { add, cmp, durationOf, eq, formatFraction, frac, meterLength, sub, ZERO } from './fraction';
import { collectIds, STORED_ID_RE } from './ids';
import { accidentalState, midiOf } from './pitch';
import { positions, tieChain, voiceLength } from './timeline';
import type {
  Chord,
  ChordNote,
  Fraction,
  Issue,
  IssueCode,
  JsonValue,
  Note,
  Rest,
  ScoreDoc,
  TimeSig,
} from './types';

/* ---------------------------------------------------------------------------
 * Structure
 * ------------------------------------------------------------------------- */

/**
 * At the schema layer an id must be an NCName — no leading digit, since that
 * is what `xml:id` forbids and what makes a document un-interchangeable. The
 * *stored* pattern (`STORED_ID_RE`) is narrower and is checked by refinement 1,
 * so a digit-leading id reads as a structural failure while a merely
 * wrong-shaped one reads as `id-pattern`.
 */
const NCNAME_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const ElementIdSchema = z.string().regex(NCNAME_RE, 'id must be an XML NCName');

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

const RecipeSchema = z
  .object({
    generatorVersion: z.string(),
    scorerVersion: z.string(),
    taxonomyVersion: z.string(),
    spec: JsonValueSchema,
    seed: z.number().int().min(0).max(0xffffffff),
  })
  .strict();

export const ScoreMetaSchema = z
  .object({
    title: z.string(),
    source: z.enum(['generated', 'authored', 'imported']),
    recipe: RecipeSchema.optional(),
    provenance: z
      .object({
        runId: z.string(),
        extractor: z.string(),
        extractorVersion: z.string(),
        inputSha256s: z.array(z.string()),
      })
      .strict()
      .optional(),
    derivedFrom: z.object({ scoreId: z.string(), hash: z.string() }).strict().optional(),
  })
  .strict()
  .refine((m) => (m.source === 'generated') === (m.recipe !== undefined), {
    message: 'meta.recipe is required iff source === "generated"',
  })
  .refine((m) => (m.source === 'imported') === (m.provenance !== undefined), {
    message: 'meta.provenance is required iff source === "imported"',
  });

const StaffDefSchema = z.object({
  id: ElementIdSchema,
  clef: z.enum(['treble', 'bass']),
  hand: z.enum(['rh', 'lh']),
});

const KeySigSchema = z.object({
  fifths: z.union([
    z.literal(-7), z.literal(-6), z.literal(-5), z.literal(-4), z.literal(-3), z.literal(-2),
    z.literal(-1), z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4),
    z.literal(5), z.literal(6), z.literal(7),
  ]),
  mode: z.enum(['major', 'minor']),
});

const TimeSigSchema = z.object({
  count: z.number().int().min(1).max(32),
  unit: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  sym: z.enum(['common', 'cut']).optional(),
  grouping: z.array(z.union([z.literal(2), z.literal(3)])).min(1).optional(),
});

const DurationSchema = z.object({
  base: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8), z.literal(16), z.literal(32)]),
  dots: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

const TempoSchema = z.object({
  bpm: z.number().int().min(20).max(300),
  unit: DurationSchema,
  text: z.string().optional(),
});

const SpelledPitchSchema = z.object({
  step: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  alter: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1), z.literal(2)]),
  octave: z.number().int().min(0).max(8),
});

const ArticulationSchema = z.enum(['staccato', 'accent', 'tenuto', 'marcato', 'staccatissimo']);
const FingerSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const TieRoleSchema = z.enum(['start', 'stop', 'both']);

const NoteSchema = z.object({
  kind: z.literal('note'),
  id: ElementIdSchema,
  pitch: SpelledPitchSchema,
  duration: DurationSchema,
  tie: TieRoleSchema.optional(),
  courtesy: z.literal(true).optional(),
  articulations: z.array(ArticulationSchema).min(1).optional(),
  fingering: FingerSchema.optional(),
});

const ChordNoteSchema = z.object({
  id: ElementIdSchema,
  pitch: SpelledPitchSchema,
  tie: TieRoleSchema.optional(),
  courtesy: z.literal(true).optional(),
  fingering: FingerSchema.optional(),
});

const ChordSchema = z.object({
  kind: z.literal('chord'),
  id: ElementIdSchema,
  duration: DurationSchema,
  notes: z.array(ChordNoteSchema).min(2),
  articulations: z.array(ArticulationSchema).min(1).optional(),
});

const RestSchema = z.object({
  kind: z.literal('rest'),
  id: ElementIdSchema,
  duration: DurationSchema,
});

const MeasureRestSchema = z.object({
  kind: z.literal('measureRest'),
  id: ElementIdSchema,
});

/** No nested tuplets in v1 — the member union deliberately excludes `tuplet`. */
const TupletMemberSchema = z.discriminatedUnion('kind', [NoteSchema, ChordSchema, RestSchema]);

const TupletGroupSchema = z.object({
  kind: z.literal('tuplet'),
  id: ElementIdSchema,
  num: z.number().int().min(1),
  numbase: z.number().int().min(1),
  events: z.array(TupletMemberSchema).min(2),
}).refine((t) => t.num !== t.numbase, { message: 'tuplet num must differ from numbase' });

const EventSchema = z.union([
  NoteSchema,
  ChordSchema,
  RestSchema,
  MeasureRestSchema,
  TupletGroupSchema,
]);

const VoiceSchema = z.object({
  id: ElementIdSchema,
  n: z.union([z.literal(1), z.literal(2)]),
  events: z.array(EventSchema).min(1),
});

const MeasureStaffSchema = z.object({
  voices: z.array(VoiceSchema).min(1).max(2),
});

const SpannerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('slur'),
    id: ElementIdSchema,
    startId: ElementIdSchema,
    endId: ElementIdSchema,
  }),
  z.object({
    kind: z.literal('hairpin'),
    id: ElementIdSchema,
    startId: ElementIdSchema,
    endId: ElementIdSchema,
    form: z.enum(['cres', 'dim']),
  }),
]);

const DirectionSchema = z.object({
  kind: z.literal('dynamic'),
  id: ElementIdSchema,
  at: ElementIdSchema,
  value: z.enum(['pp', 'p', 'mp', 'mf', 'f', 'ff']),
});

const MeasureSchema = z.object({
  id: ElementIdSchema,
  pickup: z.literal(true).optional(),
  complement: z.literal(true).optional(),
  systemBreak: z.literal(true).optional(),
  keySig: KeySigSchema.optional(),
  timeSig: TimeSigSchema.optional(),
  tempo: TempoSchema.optional(),
  staves: z.array(MeasureStaffSchema).min(1),
  spanners: z.array(SpannerSchema),
  directions: z.array(DirectionSchema),
});

export const ScoreDocSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  meta: ScoreMetaSchema,
  /** Piano v1: exactly two staves, distinct hands. */
  // zod still runs a `.refine` after a failed `.length`, so the guard is real.
  staves: z.array(StaffDefSchema).length(2).refine((s) => s.length !== 2 || s[0].hand !== s[1].hand, {
    message: 'the two staves must have distinct hands',
  }),
  keySig: KeySigSchema,
  timeSig: TimeSigSchema,
  tempo: TempoSchema,
  measures: z.array(MeasureSchema).min(1),
});

/**
 * Compile-time proof that the zod schema and `types.ts` describe the same
 * shape. If either drifts, one of these two assignments stops type-checking —
 * which is the point: SC2–SC9 read `types.ts`, and the runtime gate is here.
 */
type Extends<A, B> = A extends B ? true : false;
export const schemaMatchesModel: [
  Extends<z.infer<typeof ScoreDocSchema>, ScoreDoc>,
  Extends<ScoreDoc, z.infer<typeof ScoreDocSchema>>,
] = [true, true];

/* ---------------------------------------------------------------------------
 * Semantics
 * ------------------------------------------------------------------------- */

/** The v1 closed set of meters, as `count/unit`. */
export const TIME_SIG_SET: ReadonlyArray<string> = [
  '2/4', '3/4', '4/4', '5/4', '2/2', '3/8', '6/8', '9/8', '12/8', '5/8', '7/8',
];

const GROUPED_METERS = new Set(['5/8', '7/8']);

const isPowerOfTwo = (n: number): boolean => n >= 1 && (n & (n - 1)) === 0;

class Issues {
  readonly list: Issue[] = [];

  add(code: IssueCode, path: Array<string | number>, message: string, ids?: string[]): void {
    this.list.push(ids ? { code, path, message, ids } : { code, path, message });
  }
}

function checkTimeSig(issues: Issues, ts: TimeSig, path: Array<string | number>): void {
  const label = `${ts.count}/${ts.unit}`;
  if (!TIME_SIG_SET.includes(label)) {
    issues.add('timesig-set', path, `${label} is outside the v1 meter set (${TIME_SIG_SET.join(' ')})`);
    return;
  }
  const needsGrouping = GROUPED_METERS.has(label);
  if (needsGrouping && !ts.grouping) {
    issues.add('timesig-grouping', path, `${label} requires an explicit grouping`);
  } else if (!needsGrouping && ts.grouping) {
    issues.add('timesig-grouping', path, `${label} must not carry a grouping`);
  } else if (ts.grouping && ts.grouping.reduce((a, b) => a + b, 0) !== ts.count) {
    issues.add('timesig-grouping', path, `grouping ${ts.grouping.join('+')} does not sum to ${ts.count}`);
  }
  if (ts.sym === 'common' && label !== '4/4') {
    issues.add('timesig-sym', path, 'sym "common" is only legal with 4/4');
  }
  if (ts.sym === 'cut' && label !== '2/2') {
    issues.add('timesig-sym', path, 'sym "cut" is only legal with 2/2');
  }
}

/** Every notehead reachable from an event, chord notes included. */
function noteheadsOf(e: Note | Chord | Rest): Array<Note | ChordNote> {
  if (e.kind === 'note') return [e];
  if (e.kind === 'chord') return e.notes;
  return [];
}

/**
 * `validateScoreDoc(doc)` — structural parse, then the semantic refinements.
 *
 * Returns `[]` for a valid document. Every consumer runs it: the generator's
 * verify step before the scorer, the importer as the promotion gate, every
 * editor command on its post-state, and `renderScoreDoc` before it will touch
 * Verovio at all.
 */
export function validateScoreDoc(input: unknown): Issue[] {
  const parsed = ScoreDocSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => ({
      code: 'schema' as const,
      path: i.path as Array<string | number>,
      message: i.message,
    }));
  }
  const doc = input as ScoreDoc;
  const issues = new Issues();

  // 1 — identity.
  const seen = new Map<string, number>();
  for (const { id, path } of collectIds(doc)) {
    if (!STORED_ID_RE.test(id)) {
      issues.add('id-pattern', path, `"${id}" is not a stored id (prefix + ten [0-9a-z])`, [id]);
    }
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    if (count === 2) issues.add('id-duplicate', path, `id "${id}" is used more than once`, [id]);
  }

  // 8 — the initial state lives on the document, never on measures[0].
  const first = doc.measures[0];
  for (const field of ['keySig', 'timeSig', 'tempo'] as const) {
    if (first[field]) {
      issues.add(
        'initial-state-on-measure',
        ['measures', 0, field],
        `measures[0] must not carry ${field}; doc.${field} is the initial state`,
        [first.id],
      );
    }
  }

  // 7 — positional and closed-set rules.
  checkTimeSig(issues, doc.timeSig, ['timeSig']);
  doc.measures.forEach((m, mi) => {
    if (m.timeSig) checkTimeSig(issues, m.timeSig, ['measures', mi, 'timeSig']);
    if (m.pickup && mi !== 0) {
      issues.add('pickup-position', ['measures', mi, 'pickup'], 'pickup is legal on measures[0] only', [m.id]);
    }
    if (m.complement) {
      if (mi !== doc.measures.length - 1) {
        issues.add('complement-position', ['measures', mi, 'complement'], 'complement is legal on the last measure only', [m.id]);
      } else if (!doc.measures[0].pickup) {
        issues.add('complement-position', ['measures', mi, 'complement'], 'complement requires measures[0].pickup', [m.id]);
      }
    }
    if (m.systemBreak && mi === 0) {
      issues.add('systembreak-position', ['measures', mi, 'systemBreak'], 'systemBreak is never legal on measures[0]', [m.id]);
    }
  });

  const attrs = effectiveAttrsByMeasure(doc);

  // 3 — containment cardinalities that depend on the document's own staff count.
  doc.measures.forEach((m, mi) => {
    if (m.staves.length !== doc.staves.length) {
      issues.add('staff-count', ['measures', mi, 'staves'], `expected ${doc.staves.length} staves, found ${m.staves.length}`, [m.id]);
    }
    m.staves.forEach((st, si) => {
      const ns = st.voices.map((v) => v.n);
      const ascending = ns.every((n, i) => i === 0 || n > ns[i - 1]);
      if (!ascending || new Set(ns).size !== ns.length) {
        issues.add('voice-n', ['measures', mi, 'staves', si, 'voices'], `voice numbers must be distinct and ascending, found ${ns.join(',')}`, [m.id]);
      }
      st.voices.forEach((v, vi) => {
        const mrests = v.events.filter((e) => e.kind === 'measureRest');
        if (mrests.length > 0 && v.events.length !== 1) {
          issues.add('mrest-not-alone', ['measures', mi, 'staves', si, 'voices', vi, 'events'], 'a MeasureRest is the only event in its voice', [v.id]);
        }
        if (mrests.length > 0 && (m.pickup || m.complement)) {
          // exp22 H: Verovio times <mRest> as a full bar even under
          // metcon="false" (RH quarter + LH mRest put measure 1 at qstamp 4;
          // with <rest dur="4"/>, at qstamp 1). Short measures carry explicit rests.
          issues.add('pickup-mrest', ['measures', mi, 'staves', si, 'voices', vi, 'events'], 'a MeasureRest is illegal in a pickup or complement measure', mrests.map((e) => e.id));
        }
      });
    });
  });

  // 2 — durations against the meter.
  let pickupLength: Fraction | null = null;
  doc.measures.forEach((m, mi) => {
    const meter = meterLength(attrs[mi].timeSig);
    const target = m.pickup
      ? null
      : m.complement
        ? pickupLength
          ? sub(meter, pickupLength)
          : null
        : meter;
    let pickupSum: Fraction | null = null;
    m.staves.forEach((st, si) => {
      st.voices.forEach((v, vi) => {
        const path = ['measures', mi, 'staves', si, 'voices', vi, 'events'];
        const total = voiceLength(v.events, meter);
        if (m.pickup) {
          if (cmp(total, meter) >= 0) {
            issues.add('pickup-not-short', path, `a pickup must be shorter than the meter (${formatFraction(total)} ≥ ${formatFraction(meter)})`, [v.id]);
          } else if (pickupSum === null) {
            pickupSum = total;
          } else if (!eq(total, pickupSum)) {
            issues.add('pickup-not-short', path, `every voice of a pickup must be the same length (${formatFraction(total)} ≠ ${formatFraction(pickupSum)})`, [v.id]);
          }
          return;
        }
        if (target === null) {
          issues.add('complement-length', path, 'a complement measure requires measures[0].pickup', [v.id]);
          return;
        }
        const c = cmp(total, target);
        if (c === 0) return;
        if (m.complement) {
          issues.add('complement-length', path, `a complement must sum to meter − pickup (${formatFraction(target)}), found ${formatFraction(total)}`, [v.id]);
        } else {
          issues.add(c > 0 ? 'voice-overfull' : 'voice-underfull', path, `voice sums to ${formatFraction(total)}, expected ${formatFraction(target)}`, [v.id]);
        }
      });
    });
    if (m.pickup) pickupLength = pickupSum;
  });

  // 4 and 5 — chords and tuplets.
  doc.measures.forEach((m, mi) => {
    m.staves.forEach((st, si) => {
      st.voices.forEach((v, vi) => {
        v.events.forEach((e, ei) => {
          const path = ['measures', mi, 'staves', si, 'voices', vi, 'events', ei];
          const chords: Array<{ chord: Chord; p: Array<string | number> }> = [];
          if (e.kind === 'chord') chords.push({ chord: e, p: path });
          if (e.kind === 'tuplet') {
            e.events.forEach((te, ti) => {
              if (te.kind === 'chord') chords.push({ chord: te, p: [...path, 'events', ti] });
            });
            let nominal = ZERO;
            for (const te of e.events) nominal = add(nominal, durationOf(te.duration));
            const ratio = frac(nominal.num, nominal.den * e.num);
            if (!isPowerOfTwo(ratio.num) || !isPowerOfTwo(ratio.den)) {
              issues.add('tuplet-ratio', path, `tuplet members sum to ${formatFraction(nominal)}, which is not ${e.num} × a power-of-two duration`, [e.id]);
            }
          }
          for (const { chord, p } of chords) {
            const midis = chord.notes.map((n) => midiOf(n.pitch));
            const ascending = midis.every((x, i) => i === 0 || x > midis[i - 1]);
            if (!ascending) {
              issues.add('chord-duplicate-pitch', [...p, 'notes'], `chord notes must be strictly ascending by sounding pitch, found ${midis.join(',')}`, [chord.id]);
            }
          }
        });
      });
    });
  });

  // 6 — ties, spanner endpoints and spanner placement.
  const pos = positions(doc);
  const endpointKind = new Map<string, 'note' | 'chord' | 'rest' | 'measureRest'>();
  const onsetById = new Map<string, Fraction>();
  const measureIndexById = new Map<string, number>();
  for (const pe of pos.events) {
    endpointKind.set(pe.event.id, pe.event.kind);
    onsetById.set(pe.event.id, pe.onset);
    measureIndexById.set(pe.event.id, pe.measureIndex);
    if (pe.event.kind === 'chord') {
      for (const n of pe.event.notes) {
        endpointKind.set(n.id, 'note');
        onsetById.set(n.id, pe.onset);
        measureIndexById.set(n.id, pe.measureIndex);
      }
    }
  }

  for (const [key, seq] of pos.byVoice) {
    seq.forEach((pe, i) => {
      const path = ['measures', pe.measureIndex, 'staves', pe.staffIndex, 'voice', key];
      for (const head of noteheadsOf(pe.event as Note | Chord | Rest)) {
        if (head.tie === 'start' || head.tie === 'both') {
          const chain = tieChain(seq, i, head);
          if (chain.broken) {
            issues.add('tie-dangling', path, `tie from "${head.id}" has no matching stop on the immediately following event`, [head.id]);
          }
        }
      }
    });
    // A stop is legitimate only if some start reaches it.
    const reached = new Set<string>();
    seq.forEach((pe, i) => {
      for (const head of noteheadsOf(pe.event as Note | Chord | Rest)) {
        if (head.tie === 'start' || head.tie === 'both') {
          for (const id of tieChain(seq, i, head).ids) reached.add(id);
        }
      }
    });
    seq.forEach((pe) => {
      const path = ['measures', pe.measureIndex, 'staves', pe.staffIndex, 'voice', key];
      for (const head of noteheadsOf(pe.event as Note | Chord | Rest)) {
        if ((head.tie === 'stop' || head.tie === 'both') && !reached.has(head.id)) {
          issues.add('tie-orphan-stop', path, `tie-stop "${head.id}" is not reached by any tie start`, [head.id]);
        }
      }
    });
  }

  doc.measures.forEach((m, mi) => {
    const check = (id: string, path: Array<string | number>, ownerId: string): boolean => {
      const kind = endpointKind.get(id);
      if (kind !== 'note' && kind !== 'chord') {
        issues.add('endpoint-unresolved', path, `"${id}" does not resolve to a note, chord note or chord`, [ownerId, id]);
        return false;
      }
      return true;
    };
    m.spanners.forEach((sp, i) => {
      const path = ['measures', mi, 'spanners', i];
      const okStart = check(sp.startId, [...path, 'startId'], sp.id);
      const okEnd = check(sp.endId, [...path, 'endId'], sp.id);
      if (!okStart || !okEnd) return;
      // exp22 J: 4.5.1 renders an empty <g> for a hairpin whose startid equals
      // its endid and warns; nothing useful is drawn either way.
      if (cmp(onsetById.get(sp.startId) as Fraction, onsetById.get(sp.endId) as Fraction) >= 0) {
        issues.add('spanner-order', path, `${sp.kind} "${sp.id}" must start strictly before it ends`, [sp.id]);
      }
      if (measureIndexById.get(sp.startId) !== mi) {
        issues.add('spanner-measure', path, `${sp.kind} "${sp.id}" must live in the measure of its start element`, [sp.id]);
      }
    });
    m.directions.forEach((d, i) => {
      const path = ['measures', mi, 'directions', i];
      if (!check(d.at, [...path, 'at'], d.id)) return;
      if (measureIndexById.get(d.at) !== mi) {
        issues.add('spanner-measure', path, `dynamic "${d.id}" must live in the measure of its target`, [d.id]);
      }
    });
  });

  // 7 — pitch range and courtesy redundancy.
  const decisions = accidentalState(doc);
  for (const pe of pos.events) {
    const heads = noteheadsOf(pe.event as Note | Chord | Rest);
    for (const head of heads) {
      const midi = midiOf(head.pitch);
      if (midi < 21 || midi > 108) {
        issues.add('range', ['measures', pe.measureIndex], `"${head.id}" sounds MIDI ${midi}, outside the piano range 21..108`, [head.id]);
      }
      if (head.courtesy && decisions.get(head.id)?.written !== null) {
        issues.add('courtesy-redundant', ['measures', pe.measureIndex], `"${head.id}" already prints an accidental, so courtesy is redundant`, [head.id]);
      }
    }
  }

  return issues.list;
}

/** Convenience for callers that only need a yes/no. */
export function isValidScoreDoc(input: unknown): input is ScoreDoc {
  return validateScoreDoc(input).length === 0;
}
