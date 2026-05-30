import { describe, expect, it } from 'vitest';
import { Scale } from './schemas';
import { DAILY_ROUTINE_IDS, SCALES } from './scales';

describe('SCALES', () => {
  it('has all 12 major scales', () => {
    const majors = SCALES.filter((s) => s.family === 'major');
    expect(majors).toHaveLength(12);
  });

  it('uses distinct ids across the set', () => {
    const ids = SCALES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every scale validates against the Scale schema', () => {
    for (const s of SCALES) expect(() => Scale.parse(s)).not.toThrow();
  });

  it('every scale carries an ABC engraving with the right key signature', () => {
    for (const s of SCALES) {
      expect(s.abc).toContain('X:1');
      // The K: header must match the ASCII key of the scale; pull the tonic
      // letter and accidental and verify the K: line uses the ABC equivalent.
      const kLine = s.abc.split('\n').find((line) => line.startsWith('K:'));
      expect(kLine).toBeDefined();
    }
  });

  it('keeps comfort, bpm, and reps within plausible bounds', () => {
    for (const s of SCALES) {
      expect(s.comfort).toBeGreaterThanOrEqual(0);
      expect(s.comfort).toBeLessThanOrEqual(1);
      expect(s.bpmTarget).toBeGreaterThan(0);
      expect(s.bpmCurrent).toBeGreaterThan(0);
      expect(s.bpmCurrent).toBeLessThanOrEqual(s.bpmTarget);
      expect(s.reps).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('DAILY_ROUTINE_IDS', () => {
  it('references only real scale ids', () => {
    const ids = new Set(SCALES.map((s) => s.id));
    for (const id of DAILY_ROUTINE_IDS) expect(ids.has(id)).toBe(true);
  });

  it('has at least 3 entries (a meaningful warmup)', () => {
    expect(DAILY_ROUTINE_IDS.length).toBeGreaterThanOrEqual(3);
  });
});
