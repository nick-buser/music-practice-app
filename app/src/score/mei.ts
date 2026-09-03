/**
 * `toMei(doc)` — ScoreDoc → MEI 5, deterministically.
 *
 * This is the seam the whole substrate hangs on: our `xml:id`s go in, Verovio
 * preserves them into the SVG `<g id>`s (`exp01`, `exp04`), and a note's id is
 * then the same string in the row, the DOM, the timemap, the anchor and the
 * verdict. Three things the serializer must own, each because Verovio does not:
 *
 * - **Beaming.** Verovio does not beam MEI input at all — eight bare eighths in
 *   4/4 render with eight flags and no beam, in 6/8 likewise (`exp09`; the ABC
 *   importer beams by spacing, which is why the legacy path looks fine). So
 *   `groupBeams` below is not a nicety: without it every generated exercise is
 *   unreadable.
 * - **Gestural pitch.** `accid.ges` on every altered note, because the key
 *   signature does not reach sounding pitch (`exp12`) — see `pitch.ts`.
 * - **Byte-identical output.** Every element the serializer invents gets a
 *   derived id, or Verovio mints a random one for it on every render (`exp01`,
 *   `exp11`). Attribute order is fixed per element type for the same reason:
 *   the MEI snapshot is a criterion, not a convenience.
 *
 * The MEI shape is the one `docs/probes/verovio/lib.mjs` proves, with the
 * document-level attributes on `<scoreDef>` per §Rules.
 */

import { effectiveAttrsByMeasure } from './attrs';
import { add, cmp, durationOf, meterLength, ZERO } from './fraction';
import {
  accidId,
  articulationId,
  beamId,
  DOC_ELEMENT_IDS,
  fingeringId,
  scoreDefChangeId,
  staffElementId,
  systemBreakId,
  tempoElementId,
  tieId,
} from './ids';
import { accidentalState } from './pitch';
import { positions, quarterBpmOf } from './timeline';
import type {
  Articulation,
  Chord,
  Duration,
  ElementId,
  Fraction,
  KeySig,
  Measure,
  Note,
  Rest,
  ScoreDoc,
  Tempo,
  TimeSig,
  Voice,
} from './types';

/* ---------------------------------------------------------------------------
 * XML emission — attribute order is part of the contract.
 * ------------------------------------------------------------------------- */

type Attr = [string, string | number | undefined];

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

function attrString(attrs: Attr[]): string {
  return attrs
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escapeAttr(String(v))}"`)
    .join('');
}

class Xml {
  private readonly lines: string[] = [];
  private depth = 0;

  open(name: string, attrs: Attr[] = []): void {
    this.lines.push(`${'  '.repeat(this.depth)}<${name}${attrString(attrs)}>`);
    this.depth += 1;
  }

  close(name: string): void {
    this.depth -= 1;
    this.lines.push(`${'  '.repeat(this.depth)}</${name}>`);
  }

  empty(name: string, attrs: Attr[] = []): void {
    this.lines.push(`${'  '.repeat(this.depth)}<${name}${attrString(attrs)}/>`);
  }

  /** An element whose content is raw markup already escaped by the caller. */
  inline(name: string, attrs: Attr[], content: string): void {
    this.lines.push(`${'  '.repeat(this.depth)}<${name}${attrString(attrs)}>${content}</${name}>`);
  }

  raw(line: string): void {
    this.lines.push(`${'  '.repeat(this.depth)}${line}`);
  }

  toString(): string {
    return this.lines.join('\n');
  }
}

/* ---------------------------------------------------------------------------
 * Value tables
 * ------------------------------------------------------------------------- */

const CLEF_SHAPE: Record<'treble' | 'bass', { shape: string; line: number }> = {
  treble: { shape: 'G', line: 2 },
  bass: { shape: 'F', line: 4 },
};

const ARTIC_MEI: Record<Articulation, string> = {
  staccato: 'stacc',
  accent: 'acc',
  tenuto: 'ten',
  marcato: 'marc',
  staccatissimo: 'stacciss',
};

/**
 * SMuFL metronome notes. The doc names whole/half/quarter/eighth/sixteenth
 * (U+ECA2, ECA3, ECA5, ECA7, ECA9) and U+ECB7 per augmentation dot; the 32nd
 * continues SMuFL's own two-apart ordering. Emitted as numeric character
 * references so the MEI bytes do not depend on the file's encoding.
 */
const MET_NOTE: Record<number, number> = { 1: 0xeca2, 2: 0xeca3, 4: 0xeca5, 8: 0xeca7, 16: 0xeca9, 32: 0xecab };
const MET_DOT = 0xecb7;

const charRef = (cp: number): string => `&#x${cp.toString(16).toUpperCase()};`;

/** MEI `@keysig`: `{n}s`, `{n}f` or `0`. */
export function keySigAttr(keySig: KeySig): string {
  if (keySig.fifths === 0) return '0';
  return `${Math.abs(keySig.fifths)}${keySig.fifths > 0 ? 's' : 'f'}`;
}

/* ---------------------------------------------------------------------------
 * Beaming
 * ------------------------------------------------------------------------- */

/**
 * Beat-group boundaries within a bar, in quarter notes: quarter groups for
 * 2/4, 3/4, 4/4 and 5/4; half groups for 2/2; dotted-quarter groups for 3/8,
 * 6/8, 9/8 and 12/8; and `TimeSig.grouping` for 5/8 and 7/8.
 */
export function beatGroups(timeSig: TimeSig): Fraction[] {
  const out: Fraction[] = [];
  let t = ZERO;
  const total = meterLength(timeSig);
  const push = (len: Fraction): void => {
    out.push(t);
    t = add(t, len);
  };
  if (timeSig.grouping) {
    for (const g of timeSig.grouping) push(durationOf({ base: timeSig.unit, dots: 0 }, { num: 1, numbase: g }));
  } else if (timeSig.unit === 8 && timeSig.count % 3 === 0) {
    for (let i = 0; i < timeSig.count / 3; i += 1) push(durationOf({ base: 4, dots: 1 }));
  } else if (timeSig.unit === 2) {
    for (let i = 0; i < timeSig.count; i += 1) push(durationOf({ base: 2, dots: 0 }));
  } else {
    for (let i = 0; i < timeSig.count * (4 / timeSig.unit); i += 1) push(durationOf({ base: 4, dots: 0 }));
  }
  while (cmp(t, total) < 0) push(durationOf({ base: 4, dots: 0 }));
  return out;
}

function groupIndex(groups: Fraction[], onset: Fraction): number {
  let idx = 0;
  for (let i = 0; i < groups.length; i += 1) if (cmp(groups[i], onset) <= 0) idx = i;
  return idx;
}

interface Placed {
  event: Note | Chord | Rest | { kind: 'measureRest'; id: ElementId } | { kind: 'tuplet' };
  onset: Fraction;
}

/**
 * Runs of two or more consecutive sub-quarter events inside one beat group.
 *
 * A rest, a quarter-or-longer, or a beat-group boundary breaks the run, and a
 * lone eighth is left flagged — a one-member `<beam>` renders as a stub with no
 * flag at all (`exp22` I: polygon true, flag false), which is wrong notation.
 */
export function groupBeams(placed: Placed[], timeSig: TimeSig): number[][] {
  const groups = beatGroups(timeSig);
  const runs: number[][] = [];
  let run: number[] = [];
  let runGroup = -1;
  const flush = (): void => {
    if (run.length >= 2) runs.push(run);
    run = [];
  };
  placed.forEach((p, i) => {
    const e = p.event;
    const beamable =
      (e.kind === 'note' || e.kind === 'chord') && (e as Note | Chord).duration.base >= 8;
    if (!beamable) {
      flush();
      runGroup = -1;
      return;
    }
    const g = groupIndex(groups, p.onset);
    if (g !== runGroup) {
      flush();
      runGroup = g;
    }
    run.push(i);
  });
  flush();
  return runs;
}

/* ---------------------------------------------------------------------------
 * Serialization
 * ------------------------------------------------------------------------- */

interface Ctx {
  decisions: ReturnType<typeof accidentalState>;
  /** Note id → 1-based staff number, for hoisted control events. */
  staffOf: Map<ElementId, number>;
}

function durationAttrs(d: Duration): Attr[] {
  return [
    ['dur', d.base],
    ['dots', d.dots > 0 ? d.dots : undefined],
  ];
}

function writeNote(
  xml: Xml,
  ctx: Ctx,
  note: Note | (Chord['notes'][number] & { duration?: undefined }),
  opts: { duration?: Duration; stemDir?: 'up' | 'down' },
): void {
  const decision = ctx.decisions.get(note.id) ?? { written: null, gestural: null };
  const courtesy = note.courtesy === true;
  const articulations = 'articulations' in note ? note.articulations : undefined;
  const attrs: Attr[] = [
    ['xml:id', note.id],
    ['pname', note.pitch.step.toLowerCase()],
    ['oct', note.pitch.octave],
    ...(opts.duration ? durationAttrs(opts.duration) : []),
    // A courtesy accidental lives entirely in the <accid> child: a note
    // carrying @accid.ges beside an <accid> child makes 4.5.1 warn and mint a
    // second accid group (`exp22` B).
    ['accid', courtesy ? undefined : (decision.written ?? undefined)],
    ['accid.ges', courtesy ? undefined : (decision.gestural ?? undefined)],
    ['tie', note.tie ? { start: 'i', stop: 't', both: 'm' }[note.tie] : undefined],
    ['stem.dir', opts.stemDir],
  ];
  const children: Array<() => void> = [];
  if (courtesy) {
    // func="caution" alone draws no parentheses; enclose="paren" does (`exp22` B:
    // childCautionOnly → 0 paren glyphs, childCautionParen → 2).
    children.push(() =>
      xml.empty('accid', [
        ['xml:id', accidId(note.id)],
        ['accid', decision.written ?? writtenFor(note.pitch.alter)],
        ['accid.ges', decision.gestural ?? undefined],
        ['func', 'caution'],
        ['enclose', 'paren'],
      ]),
    );
  }
  if (articulations) {
    articulations.forEach((a, i) =>
      children.push(() => xml.empty('artic', [['xml:id', articulationId(note.id, i)], ['artic', ARTIC_MEI[a]]])),
    );
  }
  if (children.length === 0) {
    xml.empty('note', attrs);
    return;
  }
  xml.open('note', attrs);
  for (const c of children) c();
  xml.close('note');
}

/** A courtesy accidental always prints, even when nothing else would. */
function writtenFor(alter: number): string {
  return { [-2]: 'ff', [-1]: 'f', 0: 'n', 1: 's', 2: 'x' }[alter] as string;
}

function writeEvent(
  xml: Xml,
  ctx: Ctx,
  event: Note | Chord | Rest | { kind: 'measureRest'; id: ElementId },
  stemDir: 'up' | 'down' | undefined,
): void {
  switch (event.kind) {
    case 'note':
      writeNote(xml, ctx, event, { duration: event.duration, stemDir });
      return;
    case 'chord': {
      const attrs: Attr[] = [
        ['xml:id', event.id],
        ...durationAttrs(event.duration),
        ['stem.dir', stemDir],
      ];
      xml.open('chord', attrs);
      for (const n of event.notes) writeNote(xml, ctx, n, {});
      if (event.articulations) {
        event.articulations.forEach((a, i) =>
          xml.empty('artic', [['xml:id', articulationId(event.id, i)], ['artic', ARTIC_MEI[a]]]),
        );
      }
      xml.close('chord');
      return;
    }
    case 'rest':
      xml.empty('rest', [['xml:id', event.id], ...durationAttrs(event.duration)]);
      return;
    case 'measureRest':
      xml.empty('mRest', [['xml:id', event.id]]);
      return;
  }
}

/** One layer's events, with beams applied to top-level runs and inside tuplets. */
function writeLayer(xml: Xml, ctx: Ctx, voice: Voice, timeSig: TimeSig, stemDir: 'up' | 'down' | undefined): void {
  xml.open('layer', [['xml:id', voice.id], ['n', voice.n]]);

  const placed: Placed[] = [];
  let onset = ZERO;
  for (const e of voice.events) {
    if (e.kind === 'tuplet') {
      placed.push({ event: { kind: 'tuplet' }, onset });
      for (const te of e.events) onset = add(onset, durationOf(te.duration, { num: e.num, numbase: e.numbase }));
    } else if (e.kind === 'measureRest') {
      placed.push({ event: e, onset });
    } else {
      placed.push({ event: e, onset });
      onset = add(onset, durationOf(e.duration));
    }
  }

  const beamStart = new Map<number, ElementId>();
  const beamEnd = new Set<number>();
  for (const run of groupBeams(placed, timeSig)) {
    beamStart.set(run[0], beamId((voice.events[run[0]] as { id: ElementId }).id));
    beamEnd.add(run[run.length - 1]);
  }

  voice.events.forEach((e, i) => {
    const open = beamStart.get(i);
    if (open !== undefined) xml.open('beam', [['xml:id', open]]);
    if (e.kind === 'tuplet') {
      // Inside a tuplet the tuplet is the outer container and beams form
      // inside it; both nestings render and time correctly (`exp09`), and this
      // is the one the doc picks.
      xml.open('tuplet', [['xml:id', e.id], ['num', e.num], ['numbase', e.numbase]]);
      const inner: Placed[] = [];
      let t = ZERO;
      for (const te of e.events) {
        inner.push({ event: te, onset: t });
        t = add(t, durationOf(te.duration, { num: e.num, numbase: e.numbase }));
      }
      const innerStart = new Map<number, ElementId>();
      const innerEnd = new Set<number>();
      for (const run of groupBeams(inner, timeSig)) {
        innerStart.set(run[0], beamId(e.events[run[0]].id));
        innerEnd.add(run[run.length - 1]);
      }
      e.events.forEach((te, j) => {
        const innerOpen = innerStart.get(j);
        if (innerOpen !== undefined) xml.open('beam', [['xml:id', innerOpen]]);
        writeEvent(xml, ctx, te, stemDir);
        if (innerEnd.has(j)) xml.close('beam');
      });
      xml.close('tuplet');
    } else {
      writeEvent(xml, ctx, e, stemDir);
    }
    if (beamEnd.has(i)) xml.close('beam');
  });

  xml.close('layer');
}

/**
 * The tempo mark. `midi.bpm` is what Verovio times by and it overrides `mm.*`
 * and `scoreDef@midi.bpm` (`exp22` E), so it is always present: without it a
 * dotted `mm.unit` is computed as 4/3 (♩. = 60 runs at 80 qpm, `exp17`). The
 * visible mark is text we compose — an attribute-only `<tempo>` renders an
 * empty `<text>` and draws nothing at all (`exp22` E).
 */
function writeTempo(xml: Xml, measure: Measure, tempo: Tempo): void {
  const glyph = MET_NOTE[tempo.unit.base];
  const dots = charRef(MET_DOT).repeat(tempo.unit.dots);
  const content =
    `${tempo.text ? `${escapeText(tempo.text)} ` : ''}` +
    `<rend fontfam="smufl">${charRef(glyph)}${dots}</rend> = ${tempo.bpm}`;
  xml.inline(
    'tempo',
    [
      ['xml:id', tempoElementId(measure.id)],
      ['staff', 1],
      ['tstamp', 1],
      ['midi.bpm', quarterBpmOf(tempo)],
      ['mm', tempo.bpm],
      ['mm.unit', tempo.unit.base],
      ['mm.dots', tempo.unit.dots],
    ],
    content,
  );
}

/**
 * Serialize a ScoreDoc to MEI 5. Deterministic: the same document always
 * produces the same bytes.
 *
 * `toMei` assumes a valid document — `renderScoreDoc` runs `validateScoreDoc`
 * first and refuses to call this on anything that fails, because Verovio would
 * render the result anyway and nothing downstream would notice (`exp19`).
 */
export function toMei(doc: ScoreDoc): string {
  const xml = new Xml();
  const attrs = effectiveAttrsByMeasure(doc);
  const decisions = accidentalState(doc);
  const pos = positions(doc);

  const staffOf = new Map<ElementId, number>();
  for (const pe of pos.events) {
    staffOf.set(pe.event.id, pe.staffIndex + 1);
    if (pe.event.kind === 'chord') for (const n of pe.event.notes) staffOf.set(n.id, pe.staffIndex + 1);
  }
  const ctx: Ctx = { decisions, staffOf };

  xml.raw('<?xml version="1.0" encoding="UTF-8"?>');
  xml.open('mei', [['xmlns', 'http://www.music-encoding.org/ns/mei'], ['meiversion', '5.0']]);
  // Verovio warns on a document with no meiHead (`exp19`), so one is always emitted.
  xml.open('meiHead');
  xml.open('fileDesc');
  xml.open('titleStmt');
  xml.inline('title', [], escapeText(doc.meta.title));
  xml.close('titleStmt');
  xml.empty('pubStmt');
  xml.close('fileDesc');
  xml.close('meiHead');
  xml.open('music');
  xml.open('body');
  xml.open('mdiv', [['xml:id', DOC_ELEMENT_IDS.mdiv]]);
  xml.open('score', [['xml:id', DOC_ELEMENT_IDS.score]]);

  xml.open('scoreDef', [
    ['xml:id', DOC_ELEMENT_IDS.scoreDef],
    ['midi.bpm', quarterBpmOf(doc.tempo)],
    ['keysig', keySigAttr(doc.keySig)],
    ['key.mode', doc.keySig.mode],
    ['meter.count', doc.timeSig.count],
    ['meter.unit', doc.timeSig.unit],
    ['meter.sym', doc.timeSig.sym],
  ]);
  xml.open('staffGrp', [
    ['xml:id', DOC_ELEMENT_IDS.staffGrp],
    ['symbol', 'brace'],
    ['bar.thru', 'true'],
  ]);
  doc.staves.forEach((s, i) => {
    const clef = CLEF_SHAPE[s.clef];
    xml.empty('staffDef', [
      ['xml:id', s.id],
      ['n', i + 1],
      ['lines', 5],
      ['clef.shape', clef.shape],
      ['clef.line', clef.line],
    ]);
  });
  xml.close('staffGrp');
  xml.close('scoreDef');

  xml.open('section', [['xml:id', DOC_ELEMENT_IDS.section]]);

  const pickupFirst = doc.measures[0]?.pickup === true;

  doc.measures.forEach((measure, mi) => {
    if (measure.systemBreak) xml.empty('sb', [['xml:id', systemBreakId(measure.id)]]);

    // A change <scoreDef> repeats only what changed. Its own id never reaches
    // the SVG (`exp01`: sdef2 rendered nothing), but it is still derived so the
    // MEI bytes stay stable.
    if (measure.keySig || measure.timeSig) {
      xml.open('scoreDef', [
        ['xml:id', scoreDefChangeId(measure.id)],
        ['keysig', measure.keySig ? keySigAttr(measure.keySig) : undefined],
        ['key.mode', measure.keySig ? measure.keySig.mode : undefined],
        ['meter.count', measure.timeSig ? measure.timeSig.count : undefined],
        ['meter.unit', measure.timeSig ? measure.timeSig.unit : undefined],
        ['meter.sym', measure.timeSig ? measure.timeSig.sym : undefined],
      ]);
      xml.open('staffGrp', []);
      doc.staves.forEach((_s, i) => {
        xml.empty('staffDef', [
          ['n', i + 1],
          ['lines', 5],
          ['keysig', measure.keySig ? keySigAttr(measure.keySig) : undefined],
          ['key.mode', measure.keySig ? measure.keySig.mode : undefined],
          ['meter.count', measure.timeSig ? measure.timeSig.count : undefined],
          ['meter.unit', measure.timeSig ? measure.timeSig.unit : undefined],
          ['meter.sym', measure.timeSig ? measure.timeSig.sym : undefined],
        ]);
      });
      xml.close('staffGrp');
      xml.close('scoreDef');
    }

    const number = pickupFirst ? mi : mi + 1;
    xml.open('measure', [
      ['xml:id', measure.id],
      ['n', number],
      ['metcon', measure.pickup || measure.complement ? 'false' : undefined],
    ]);

    const timeSig = attrs[mi].timeSig;
    measure.staves.forEach((staff, si) => {
      xml.open('staff', [['xml:id', staffElementId(measure.id, si + 1)], ['n', si + 1]]);
      const bothVoices = staff.voices.length > 1;
      for (const voice of staff.voices) {
        const stemDir = bothVoices ? (voice.n === 1 ? 'up' : 'down') : undefined;
        writeLayer(xml, ctx, voice, timeSig, stemDir);
      }
      xml.close('staff');
    });

    // Ties, spanners, dynamics, fingerings and the tempo mark are children of
    // the *measure* — Verovio renders every one of them there (`exp01`).
    for (const pe of pos.events) {
      if (pe.measureIndex !== mi) continue;
      const heads =
        pe.event.kind === 'note'
          ? [pe.event]
          : pe.event.kind === 'chord'
            ? pe.event.notes
            : [];
      for (const head of heads) {
        if (head.tie !== 'start' && head.tie !== 'both') continue;
        const partner = tiePartner(pos, pe, head);
        if (!partner) continue;
        // The element form, never @tie: attribute-form ties get a random id
        // (`exp11`) and are dropped across layers with a console warning, while
        // the element form renders across layers (`exp22` G).
        xml.empty('tie', [
          ['xml:id', tieId(head.id)],
          ['startid', `#${head.id}`],
          ['endid', `#${partner}`],
        ]);
      }
    }

    for (const sp of measure.spanners) {
      if (sp.kind === 'slur') {
        xml.empty('slur', [
          ['xml:id', sp.id],
          ['startid', `#${sp.startId}`],
          ['endid', `#${sp.endId}`],
        ]);
      } else {
        xml.empty('hairpin', [
          ['xml:id', sp.id],
          ['staff', ctx.staffOf.get(sp.startId) ?? 1],
          ['form', sp.form],
          ['startid', `#${sp.startId}`],
          ['endid', `#${sp.endId}`],
        ]);
      }
    }

    for (const d of measure.directions) {
      xml.inline(
        'dynam',
        [['xml:id', d.id], ['staff', ctx.staffOf.get(d.at) ?? 1], ['startid', `#${d.at}`]],
        escapeText(d.value),
      );
    }

    for (const pe of pos.events) {
      if (pe.measureIndex !== mi) continue;
      const heads =
        pe.event.kind === 'note'
          ? [pe.event]
          : pe.event.kind === 'chord'
            ? pe.event.notes
            : [];
      for (const head of heads) {
        if (head.fingering === undefined) continue;
        xml.inline(
          'fing',
          [
            ['xml:id', fingeringId(head.id)],
            ['staff', pe.staffIndex + 1],
            ['startid', `#${head.id}`],
          ],
          String(head.fingering),
        );
      }
    }

    // The document tempo is the initial state and `measures[0]` never carries
    // it (refinement 8) — but it still has to be *visible*, so the serializer
    // renders it as measure 0's mark, alongside `scoreDef@midi.bpm`.
    const mark = mi === 0 ? doc.tempo : measure.tempo;
    if (mark) writeTempo(xml, measure, mark);

    xml.close('measure');
  });

  xml.close('section');
  xml.close('score');
  xml.close('mdiv');
  xml.close('body');
  xml.close('music');
  xml.close('mei');
  return `${xml.toString()}\n`;
}

/**
 * The id a tie from `head` ends on, per the pairing rule (§Rules): the
 * immediately following event in the same staff and `Voice.n`, matched by
 * spelled pitch. Returns null when nothing matches — `validateScoreDoc` has
 * already reported that as `tie-dangling`, so the serializer simply omits the
 * `<tie>` rather than emitting one with a dangling `endid`.
 */
function tiePartner(
  pos: ReturnType<typeof positions>,
  pe: ReturnType<typeof positions>['events'][number],
  head: { id: ElementId; pitch: Note['pitch'] },
): ElementId | null {
  const seq = pos.byVoice.get(`${pe.staffIndex}:${pe.voiceN}`);
  if (!seq) return null;
  const i = seq.indexOf(pe);
  const next = seq[i + 1];
  if (!next || next.measureIndex > pe.measureIndex + 1) return null;
  const candidates =
    next.event.kind === 'note' ? [next.event] : next.event.kind === 'chord' ? next.event.notes : [];
  const match = candidates.find(
    (n) =>
      n.pitch.step === head.pitch.step &&
      n.pitch.alter === head.pitch.alter &&
      n.pitch.octave === head.pitch.octave &&
      (n.tie === 'stop' || n.tie === 'both'),
  );
  return match ? match.id : null;
}
