/**
 * Element identity: minting, the stored-id pattern, the derived-id vocabulary
 * and `cloneScoreDoc`.
 *
 * The whole substrate hangs on one property (`docs/score-substrate.md`
 * §Identity): an element id is the *same string* in the database row, the MEI
 * `xml:id`, the SVG `<g id>`, the timemap entry, the annotation anchor and the
 * assessment verdict. Three consequences shape this module:
 *
 * - Ids are minted through an injected `IdSource`, never by the model. The
 *   generator needs "same recipe, same notes" with no clock, so it passes a
 *   seeded source; the editor and the importer pass a crypto-random one.
 * - Ids are NCNames. `xml:id` forbids a leading digit, which rules out ULIDs
 *   and UUIDs — Verovio itself passes digit-leading ids through unharmed
 *   (`exp04`), so this is about schema-valid MEI, interchange and `#id` CSS
 *   selectors, not about rendering.
 * - Everything the *serializer* invents (beams, ties, staves, the tempo mark)
 *   gets an id derived from its owner. Without that Verovio mints a random id
 *   for each on every render (`exp01`, `exp11`) and the emitted MEI stops
 *   being byte-identical run to run.
 */

import type {
  Chord,
  Direction,
  ElementId,
  ElementKind,
  Event,
  Measure,
  Note,
  Rest,
  ScoreDoc,
  Spanner,
  Voice,
} from './types';

/** The one injection point for identity. */
export interface IdSource {
  next(kind: ElementKind): ElementId;
}

/**
 * Kind prefixes. Note and chord note share `n` — a chord note *is* a notehead
 * and verdicts land on noteheads, so the two are the same kind of thing to
 * every consumer.
 */
export const ID_PREFIX: Record<ElementKind, string> = {
  measure: 'm',
  voice: 'v',
  note: 'n',
  chord: 'c',
  rest: 'r',
  measureRest: 'mr',
  tuplet: 't',
  slur: 'sl',
  hairpin: 'hp',
  dynamic: 'dy',
  staffDef: 'sd',
};

/**
 * A stored id is exactly a prefix plus ten `[0-9a-z]`. The `-` of a derived id
 * cannot match, so a minted id can never collide with a derived one — which is
 * why the schema can reject a stored id in the derived form outright.
 */
export const STORED_ID_RE = /^[a-z]{1,2}[0-9a-z]{10}$/;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const BODY_LENGTH = 10;

function body(draw: () => number): string {
  let out = '';
  for (let i = 0; i < BODY_LENGTH; i += 1) out += ALPHABET[draw()];
  return out;
}

/**
 * Deterministic minting from an injected `rng` returning [0, 1). The generator
 * seeds this from the recipe, so regenerating a recipe reproduces every id.
 */
export function seededIdSource(rng: () => number): IdSource {
  return {
    next(kind) {
      return ID_PREFIX[kind] + body(() => Math.min(ALPHABET.length - 1, Math.floor(rng() * ALPHABET.length)));
    },
  };
}

/**
 * Crypto-random minting for the editor and the importer. Bytes ≥ 252 are
 * rejected rather than folded, because 256 % 36 ≠ 0 and a modulo bias here
 * would quietly shrink the id space every consumer assumes is uniform.
 */
export function randomIdSource(): IdSource {
  const pool: number[] = [];
  const drawByte = (): number => {
    if (pool.length === 0) {
      const buf = new Uint8Array(64);
      crypto.getRandomValues(buf);
      for (const b of buf) pool.push(b);
    }
    return pool.pop() as number;
  };
  return {
    next(kind) {
      return (
        ID_PREFIX[kind] +
        body(() => {
          let b = drawByte();
          while (b >= 252) b = drawByte();
          return b % ALPHABET.length;
        })
      );
    },
  };
}

/* ---------------------------------------------------------------------------
 * Derived ids — the complete list from §Identity. Every element the serializer
 * creates gets its id from here; nothing in this list is a legal anchor.
 * ------------------------------------------------------------------------- */

export const beamId = (firstMemberId: ElementId): string => `${firstMemberId}-beam`;
export const tieId = (startNoteId: ElementId): string => `${startNoteId}-tie`;
export const articulationId = (ownerId: ElementId, i: number): string => `${ownerId}-a${i}`;
export const fingeringId = (noteId: ElementId): string => `${noteId}-fing`;
export const accidId = (noteId: ElementId): string => `${noteId}-acc`;
export const staffElementId = (measureId: ElementId, n: number): string => `${measureId}-s${n}`;
export const systemBreakId = (measureId: ElementId): string => `${measureId}-sb`;
export const tempoElementId = (measureId: ElementId): string => `${measureId}-tempo`;
export const scoreDefChangeId = (measureId: ElementId): string => `${measureId}-sdef`;

/** The five document-level elements, one each, fixed. */
export const DOC_ELEMENT_IDS = {
  mdiv: 'mdiv',
  score: 'score',
  scoreDef: 'sdef',
  staffGrp: 'sg',
  section: 'sec',
} as const;

/* ------------------------------------------------------------------------- */

/** Every stored id in the document, in document order (duplicates included). */
export function collectIds(doc: ScoreDoc): Array<{ id: ElementId; path: Array<string | number> }> {
  const out: Array<{ id: ElementId; path: Array<string | number> }> = [];
  doc.staves.forEach((s, i) => out.push({ id: s.id, path: ['staves', i, 'id'] }));
  doc.measures.forEach((m, mi) => {
    const mp: Array<string | number> = ['measures', mi];
    out.push({ id: m.id, path: [...mp, 'id'] });
    m.staves.forEach((st, si) => {
      st.voices.forEach((v, vi) => {
        const vp = [...mp, 'staves', si, 'voices', vi];
        out.push({ id: v.id, path: [...vp, 'id'] });
        v.events.forEach((e, ei) => {
          const ep = [...vp, 'events', ei];
          out.push({ id: e.id, path: [...ep, 'id'] });
          if (e.kind === 'chord') e.notes.forEach((n, ni) => out.push({ id: n.id, path: [...ep, 'notes', ni, 'id'] }));
          if (e.kind === 'tuplet') {
            e.events.forEach((te, ti) => {
              const tp = [...ep, 'events', ti];
              out.push({ id: te.id, path: [...tp, 'id'] });
              if (te.kind === 'chord') {
                te.notes.forEach((n, ni) => out.push({ id: n.id, path: [...tp, 'notes', ni, 'id'] }));
              }
            });
          }
        });
      });
    });
    m.spanners.forEach((sp, i) => out.push({ id: sp.id, path: [...mp, 'spanners', i, 'id'] }));
    m.directions.forEach((d, i) => out.push({ id: d.id, path: [...mp, 'directions', i, 'id'] }));
  });
  return out;
}

/**
 * Deep copy with every id re-minted, spanner endpoints and direction targets
 * remapped, a fresh document UUID and `meta.derivedFrom` set.
 *
 * The `idMap` is returned rather than kept private because the one caller that
 * legitimately wants annotations to follow a copy (§Editing, "paste re-mints")
 * has to remap its own anchors, and only it knows whether that is wanted.
 */
export function cloneScoreDoc(
  doc: ScoreDoc,
  ids: IdSource,
  options: { docId: string; hash: string },
): { doc: ScoreDoc; idMap: Map<ElementId, ElementId> } {
  const idMap = new Map<ElementId, ElementId>();
  const remint = (id: ElementId, kind: ElementKind): ElementId => {
    const next = ids.next(kind);
    idMap.set(id, next);
    return next;
  };
  // Endpoints are resolved in a second pass: a slur may point forward at a
  // note the first pass has not reached yet.
  const resolve = (id: ElementId): ElementId => idMap.get(id) ?? id;

  const cloneNote = (e: Note): Note => ({
    ...e,
    id: remint(e.id, 'note'),
    pitch: { ...e.pitch },
    duration: { ...e.duration },
    ...(e.articulations ? { articulations: [...e.articulations] } : {}),
  });
  const cloneChord = (e: Chord): Chord => ({
    ...e,
    id: remint(e.id, 'chord'),
    duration: { ...e.duration },
    notes: e.notes.map((n) => ({ ...n, id: remint(n.id, 'note'), pitch: { ...n.pitch } })),
    ...(e.articulations ? { articulations: [...e.articulations] } : {}),
  });
  const cloneRest = (e: Rest): Rest => ({ ...e, id: remint(e.id, 'rest'), duration: { ...e.duration } });
  const cloneInner = (e: Note | Chord | Rest): Note | Chord | Rest =>
    e.kind === 'note' ? cloneNote(e) : e.kind === 'chord' ? cloneChord(e) : cloneRest(e);

  const cloneEvent = (e: Event): Event => {
    switch (e.kind) {
      case 'note':
        return cloneNote(e);
      case 'chord':
        return cloneChord(e);
      case 'rest':
        return cloneRest(e);
      case 'measureRest':
        return { ...e, id: remint(e.id, 'measureRest') };
      case 'tuplet':
        return { ...e, id: remint(e.id, 'tuplet'), events: e.events.map(cloneInner) };
    }
  };

  const measures: Measure[] = doc.measures.map((m) => {
    const id = remint(m.id, 'measure');
    const staves = m.staves.map((st) => ({
      voices: st.voices.map(
        (v): Voice => ({ ...v, id: remint(v.id, 'voice'), events: v.events.map(cloneEvent) }),
      ),
    }));
    return { ...m, id, staves, spanners: m.spanners, directions: m.directions };
  });

  // Second pass: endpoints, now that every event id is known.
  measures.forEach((m, mi) => {
    m.spanners = doc.measures[mi].spanners.map(
      (sp): Spanner => ({
        ...sp,
        id: remint(sp.id, sp.kind === 'slur' ? 'slur' : 'hairpin'),
        startId: resolve(sp.startId),
        endId: resolve(sp.endId),
      }),
    );
    m.directions = doc.measures[mi].directions.map(
      (d): Direction => ({ ...d, id: remint(d.id, 'dynamic'), at: resolve(d.at) }),
    );
  });

  const cloned: ScoreDoc = {
    ...doc,
    id: options.docId,
    revision: 1,
    meta: { ...doc.meta, derivedFrom: { scoreId: doc.id, hash: options.hash } },
    staves: doc.staves.map((s) => ({ ...s, id: remint(s.id, 'staffDef') })),
    keySig: { ...doc.keySig },
    timeSig: { ...doc.timeSig, ...(doc.timeSig.grouping ? { grouping: [...doc.timeSig.grouping] } : {}) },
    tempo: { ...doc.tempo, unit: { ...doc.tempo.unit } },
    measures,
  };
  return { doc: cloned, idMap };
}
