import { describe, expect, it } from 'vitest';

import { grandStaffExercise } from './__fixtures__';
import { mulberry32 } from './__fixtures__/dsl';
import {
  accidId,
  articulationId,
  beamId,
  cloneScoreDoc,
  collectIds,
  DOC_ELEMENT_IDS,
  fingeringId,
  ID_PREFIX,
  randomIdSource,
  scoreDefChangeId,
  seededIdSource,
  staffElementId,
  STORED_ID_RE,
  systemBreakId,
  tempoElementId,
  tieId,
} from './ids';
import { validateScoreDoc } from './schema';
import type { ElementKind } from './types';

const ALL_KINDS: ElementKind[] = [
  'measure', 'voice', 'note', 'chord', 'rest', 'measureRest',
  'tuplet', 'slur', 'hairpin', 'dynamic', 'staffDef',
];

/** XML NCName: a letter or underscore, then letters, digits, `.`, `-`, `_`. */
const NCNAME_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

describe('seededIdSource', () => {
  it('mints the same sequence twice from one seed', () => {
    const a = seededIdSource(mulberry32(1234));
    const b = seededIdSource(mulberry32(1234));
    const seqA = ALL_KINDS.map((k) => a.next(k));
    const seqB = ALL_KINDS.map((k) => b.next(k));
    expect(seqA).toEqual(seqB);
  });

  it('mints a different sequence from a different seed', () => {
    const a = seededIdSource(mulberry32(1));
    const b = seededIdSource(mulberry32(2));
    expect(a.next('note')).not.toBe(b.next('note'));
  });

  it('mints the stored pattern, with the right prefix, for every kind', () => {
    const src = seededIdSource(mulberry32(99));
    for (const kind of ALL_KINDS) {
      const id = src.next(kind);
      expect(id, `${kind} → ${id}`).toMatch(STORED_ID_RE);
      expect(id.startsWith(ID_PREFIX[kind])).toBe(true);
      expect(id).toHaveLength(ID_PREFIX[kind].length + 10);
      expect(id).toMatch(NCNAME_RE);
    }
  });

  it('never mints a digit-leading id, whatever the rng returns', () => {
    // Both extremes of the rng range, which are what an off-by-one would expose.
    for (const rng of [() => 0, () => 0.9999999999]) {
      for (const kind of ALL_KINDS) {
        const id = seededIdSource(rng).next(kind);
        expect(id).toMatch(STORED_ID_RE);
        expect(id).toMatch(NCNAME_RE);
      }
    }
  });
});

describe('randomIdSource', () => {
  it('mints stored-pattern NCNames and does not repeat', () => {
    const src = randomIdSource();
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      const id = src.next('note');
      expect(id).toMatch(STORED_ID_RE);
      expect(id).toMatch(NCNAME_RE);
      seen.add(id);
    }
    expect(seen.size).toBe(500);
  });
});

describe('derived ids', () => {
  it('all take the `-suffix` form, which a stored id can never match', () => {
    const owner = 'n0123456789';
    const derived = [
      beamId(owner),
      tieId(owner),
      articulationId(owner, 0),
      articulationId(owner, 1),
      fingeringId(owner),
      accidId(owner),
      staffElementId('m0123456789', 2),
      systemBreakId('m0123456789'),
      tempoElementId('m0123456789'),
      scoreDefChangeId('m0123456789'),
    ];
    for (const id of derived) {
      expect(id).toContain('-');
      expect(id).not.toMatch(STORED_ID_RE);
      expect(id).toMatch(NCNAME_RE);
    }
    expect(derived).toEqual([
      'n0123456789-beam',
      'n0123456789-tie',
      'n0123456789-a0',
      'n0123456789-a1',
      'n0123456789-fing',
      'n0123456789-acc',
      'm0123456789-s2',
      'm0123456789-sb',
      'm0123456789-tempo',
      'm0123456789-sdef',
    ]);
  });

  it('gives the five document-level elements fixed NCName ids', () => {
    for (const id of Object.values(DOC_ELEMENT_IDS)) expect(id).toMatch(NCNAME_RE);
    expect(Object.values(DOC_ELEMENT_IDS)).toEqual(['mdiv', 'score', 'sdef', 'sg', 'sec']);
  });
});

describe('cloneScoreDoc', () => {
  const source = grandStaffExercise();
  const { doc: copy, idMap } = cloneScoreDoc(source, seededIdSource(mulberry32(777)), {
    docId: 'abcdef01-2345-4678-89ab-cdef01234567',
    hash: 'deadbeef',
  });

  it('produces a valid document', () => {
    expect(validateScoreDoc(copy)).toEqual([]);
  });

  it('shares no id with its source', () => {
    const before = new Set(collectIds(source).map((x) => x.id));
    const after = collectIds(copy).map((x) => x.id);
    expect(after).toHaveLength(collectIds(source).length);
    for (const id of after) expect(before.has(id)).toBe(false);
  });

  it('maps every source id exactly once', () => {
    const before = collectIds(source).map((x) => x.id);
    for (const id of before) expect(idMap.get(id)).toBeDefined();
    expect(new Set(idMap.values()).size).toBe(idMap.size);
  });

  it('remaps every spanner endpoint and direction target', () => {
    source.measures.forEach((m, mi) => {
      m.spanners.forEach((sp, i) => {
        const copied = copy.measures[mi].spanners[i];
        expect(copied.startId).toBe(idMap.get(sp.startId));
        expect(copied.endId).toBe(idMap.get(sp.endId));
      });
      m.directions.forEach((d, i) => {
        expect(copy.measures[mi].directions[i].at).toBe(idMap.get(d.at));
      });
    });
  });

  it('mints a new document id, resets the revision and records the parent', () => {
    expect(copy.id).toBe('abcdef01-2345-4678-89ab-cdef01234567');
    expect(copy.revision).toBe(1);
    expect(copy.meta.derivedFrom).toEqual({ scoreId: source.id, hash: 'deadbeef' });
  });

  it('deep-copies, so mutating the copy leaves the source alone', () => {
    const c = cloneScoreDoc(source, seededIdSource(mulberry32(778)), { docId: copy.id, hash: 'x' }).doc;
    c.measures[0].staves[0].voices[0].events[0].id = 'nzzzzzzzzzz';
    c.keySig.fifths = 7;
    expect(source.keySig.fifths).toBe(1);
    expect(source.measures[0].staves[0].voices[0].events[0].id).not.toBe('nzzzzzzzzzz');
  });
});
