import { describe, expect, it } from 'vitest';

import { grandStaffExercise } from './__fixtures__';
import { migrateScoreDoc, ScoreDocVersionError } from './migrate';
import { validateScoreDoc } from './schema';
import { SCORE_SCHEMA_VERSION } from './types';

describe('migrateScoreDoc', () => {
  it('passes a current document through unchanged and still valid', () => {
    const doc = grandStaffExercise();
    const out = migrateScoreDoc(JSON.parse(JSON.stringify(doc)));
    expect(out).toEqual(doc);
    expect(validateScoreDoc(out)).toEqual([]);
    expect(out.schemaVersion).toBe(SCORE_SCHEMA_VERSION);
  });

  it('does not mutate the blob it was handed', () => {
    const blob = JSON.parse(JSON.stringify(grandStaffExercise())) as Record<string, unknown>;
    const before = JSON.stringify(blob);
    migrateScoreDoc(blob);
    expect(JSON.stringify(blob)).toBe(before);
  });

  it('refuses a document from a newer client rather than mangling it', () => {
    const blob = { ...grandStaffExercise(), schemaVersion: SCORE_SCHEMA_VERSION + 1 };
    expect(() => migrateScoreDoc(blob)).toThrow(ScoreDocVersionError);
    expect(() => migrateScoreDoc(blob)).toThrow(/newer than this client/);
  });

  it('refuses a blob with no usable schemaVersion', () => {
    expect(() => migrateScoreDoc({})).toThrow(ScoreDocVersionError);
    expect(() => migrateScoreDoc({ schemaVersion: 0 })).toThrow(ScoreDocVersionError);
    expect(() => migrateScoreDoc({ schemaVersion: '1' })).toThrow(ScoreDocVersionError);
    expect(() => migrateScoreDoc(null)).toThrow(ScoreDocVersionError);
    expect(() => migrateScoreDoc([])).toThrow(ScoreDocVersionError);
  });

  it('leaves validation to validateScoreDoc — a migrated blob is not a checked one', () => {
    // Migration failing and a document being invalid are different problems.
    const out = migrateScoreDoc({ schemaVersion: 1, nonsense: true });
    expect(validateScoreDoc(out).length).toBeGreaterThan(0);
  });
});
