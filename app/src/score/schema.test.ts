import { describe, expect, it } from 'vitest';

import * as fx from './__fixtures__';
import { validateScoreDoc } from './schema';
import type { IssueCode } from './types';

const codes = (doc: unknown): IssueCode[] => [...new Set(validateScoreDoc(doc).map((i) => i.code))].sort();

describe('validateScoreDoc — positives', () => {
  it.each(fx.POSITIVE_FIXTURES)('accepts %s', (_name, make) => {
    expect(validateScoreDoc(make())).toEqual([]);
  });

  it('accepts the ♪ ♬ ♪ triplet: its members sum to 3 × an eighth', () => {
    // Refinement 5 is about the *ratio*, not about equal members — this is the
    // case a naive "all members the same duration" rule would wrongly reject.
    expect(validateScoreDoc(fx.unevenTriplet())).toEqual([]);
  });
});

describe('validateScoreDoc — semantic refinements', () => {
  const cases: Array<[string, () => unknown, IssueCode]> = [
    ['an overfull voice', fx.overfullVoice, 'voice-overfull'],
    ['an underfull voice', fx.underfullVoice, 'voice-underfull'],
    ['a dangling tie', fx.danglingTie, 'tie-dangling'],
    ['an orphan tie-stop', fx.orphanTieStop, 'tie-orphan-stop'],
    ['a duplicate id', fx.duplicateId, 'id-duplicate'],
    ['a MeasureRest in a pickup', fx.measureRestInPickup, 'pickup-mrest'],
    ['tempo on measures[0]', fx.initialStateOnMeasureZero, 'initial-state-on-measure'],
    ['courtesy on a note that already prints', fx.courtesyRedundant, 'courtesy-redundant'],
    ['a same-endpoint hairpin', fx.sameEndpointHairpin, 'spanner-order'],
    ['a spanner in the wrong measure', fx.spannerInWrongMeasure, 'spanner-measure'],
    ['a spanner ending on a rest', fx.endpointOnRest, 'endpoint-unresolved'],
    ['a meter outside the v1 set', fx.meterOutsideSet, 'timesig-set'],
    ['5/8 with no grouping', fx.timeSigGroupingMissing, 'timesig-grouping'],
    ['cut time on 4/4', fx.timeSigBadSym, 'timesig-sym'],
    ['a tuplet whose members do not fit its ratio', fx.tupletBadRatio, 'tuplet-ratio'],
    ['an enharmonic chord pair', fx.chordNotAscending, 'chord-duplicate-pitch'],
    ['a note below the piano', fx.outOfRange, 'range'],
    ['a MeasureRest sharing its voice', fx.mrestNotAlone, 'mrest-not-alone'],
    ['a system break on measures[0]', fx.systemBreakOnFirstMeasure, 'systembreak-position'],
    ['a stored id in the wrong shape', fx.badStoredIdShape, 'id-pattern'],
  ];

  it.each(cases)('rejects %s with %s', (_name, make, code) => {
    expect(codes(make())).toContain(code);
  });

  it('reports the issue path and the offending ids', () => {
    const issue = validateScoreDoc(fx.overfullVoice()).find((i) => i.code === 'voice-overfull');
    expect(issue?.path).toEqual(['measures', 0, 'staves', 0, 'voices', 0, 'events']);
    expect(issue?.message).toContain('expected 4');
    expect(issue?.ids).toHaveLength(1);
  });
});

describe('validateScoreDoc — structural failures report as `schema`', () => {
  const cases: Array<[string, () => unknown]> = [
    ['a nested tuplet', fx.nestedTuplet],
    ['a one-note chord', fx.oneNoteChord],
    ['a wrong staff count', fx.wrongStaffCount],
    ['a digit-leading id', fx.digitLeadingId],
  ];

  it.each(cases)('rejects %s', (_name, make) => {
    const issues = validateScoreDoc(make());
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.code === 'schema')).toBe(true);
    expect(issues[0].path.length).toBeGreaterThan(0);
  });

  it('rejects a document that is not an object at all', () => {
    expect(codes(null)).toEqual(['schema']);
    expect(codes(42)).toEqual(['schema']);
    expect(codes({})).toEqual(['schema']);
  });

  it('closes `meta`: an unknown key is a structural failure', () => {
    const doc = fx.simpleValid() as unknown as { meta: Record<string, unknown> };
    doc.meta.notAField = 1;
    expect(codes(doc)).toEqual(['schema']);
  });

  it('requires `recipe` exactly when the source is generated', () => {
    const doc = fx.simpleValid() as unknown as { meta: Record<string, unknown> };
    doc.meta.source = 'generated';
    expect(codes(doc)).toEqual(['schema']);
  });
});
