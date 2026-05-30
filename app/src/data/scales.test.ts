import { describe, expect, it } from 'vitest';
import { Scale } from './schemas';
import { DAILY_ROUTINE_IDS, SCALES, SCALE_BY_ID } from './scales';

describe('SCALES', () => {
  it('has 12 major scales', () => {
    expect(SCALES.filter((s) => s.family === 'major')).toHaveLength(12);
  });

  it('has 36 minor scales (12 keys × 3 variants)', () => {
    expect(SCALES.filter((s) => s.family === 'natural-minor')).toHaveLength(12);
    expect(SCALES.filter((s) => s.family === 'harmonic-minor')).toHaveLength(12);
    expect(SCALES.filter((s) => s.family === 'melodic-minor')).toHaveLength(12);
  });

  it('has 24 arpeggios (12 major + 12 minor)', () => {
    expect(SCALES.filter((s) => s.family === 'major-arpeggio')).toHaveLength(12);
    expect(SCALES.filter((s) => s.family === 'minor-arpeggio')).toHaveLength(12);
  });

  it('totals 72 entries', () => {
    expect(SCALES).toHaveLength(72);
  });

  it('uses distinct ids across the set', () => {
    const ids = SCALES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every scale validates against the Scale schema', () => {
    for (const s of SCALES) expect(() => Scale.parse(s)).not.toThrow();
  });

  it('every minor scale carries the matching variant tag', () => {
    for (const s of SCALES) {
      if (s.family === 'natural-minor') expect(s.variant).toBe('natural');
      else if (s.family === 'harmonic-minor') expect(s.variant).toBe('harmonic');
      else if (s.family === 'melodic-minor') expect(s.variant).toBe('melodic');
      else expect(s.variant).toBeUndefined();
    }
  });

  it('every scale carries an ABC engraving with a K: line', () => {
    for (const s of SCALES) {
      expect(s.abc).toContain('X:1');
      const kLine = s.abc.split('\n').find((line) => line.startsWith('K:'));
      expect(kLine).toBeDefined();
    }
  });

  it('harmonic-minor ABCs raise their 7th degree (carry a ^ or = accidental)', () => {
    const harm = SCALES.filter((s) => s.family === 'harmonic-minor');
    for (const s of harm) {
      const notes = s.abc.split('\n').pop() ?? '';
      // Either an explicit sharp (`^`) or a key-sig override (`=`) appears.
      expect(notes).toMatch(/[\^=]/);
    }
  });

  it('melodic-minor ABCs raise both 6th and 7th (at least two accidentals)', () => {
    const mel = SCALES.filter((s) => s.family === 'melodic-minor');
    for (const s of mel) {
      const notes = s.abc.split('\n').pop() ?? '';
      const matches = notes.match(/[\^=]/g);
      expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
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

  it('SCALE_BY_ID maps every id back to its scale', () => {
    for (const s of SCALES) expect(SCALE_BY_ID.get(s.id)?.id).toBe(s.id);
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

  it('includes a mix of majors, minors, and arpeggios', () => {
    const byId = new Map(SCALES.map((s) => [s.id, s]));
    const families = new Set(DAILY_ROUTINE_IDS.map((id) => byId.get(id)?.family));
    expect(families.size).toBeGreaterThanOrEqual(3);
  });
});
