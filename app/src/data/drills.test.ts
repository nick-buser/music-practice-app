import { describe, expect, it } from 'vitest';
import { Drill, type TechniqueFamily } from './schemas';
import { DAILY_ROUTINE_IDS, DRILLS, DRILL_BY_ID } from './drills';

describe('DRILLS', () => {
  it('has 12 major scales', () => {
    expect(DRILLS.filter((d) => d.family === 'major')).toHaveLength(12);
  });

  it('has 36 minor scales (12 keys × 3 variants)', () => {
    expect(DRILLS.filter((d) => d.family === 'natural-minor')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'harmonic-minor')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'melodic-minor')).toHaveLength(12);
  });

  it('has 24 arpeggios (12 major + 12 minor)', () => {
    expect(DRILLS.filter((d) => d.family === 'major-arpeggio')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'minor-arpeggio')).toHaveLength(12);
  });

  it('has 24 chords (12 major triads + 12 minor triads)', () => {
    expect(DRILLS.filter((d) => d.family === 'major-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'minor-chord')).toHaveLength(12);
  });

  it('totals 96 entries', () => {
    expect(DRILLS).toHaveLength(96);
  });

  it('uses distinct ids across the set', () => {
    const ids = DRILLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every drill validates against the Drill schema', () => {
    for (const d of DRILLS) expect(() => Drill.parse(d)).not.toThrow();
  });

  it('every minor scale carries the matching variant tag', () => {
    for (const d of DRILLS) {
      if (d.family === 'natural-minor') expect(d.variant).toBe('natural');
      else if (d.family === 'harmonic-minor') expect(d.variant).toBe('harmonic');
      else if (d.family === 'melodic-minor') expect(d.variant).toBe('melodic');
      else expect(d.variant).toBeUndefined();
    }
  });

  it('every drill carries an ABC engraving with a K: line', () => {
    for (const d of DRILLS) {
      expect(d.abc).toContain('X:1');
      const kLine = d.abc.split('\n').find((line) => line.startsWith('K:'));
      expect(kLine).toBeDefined();
    }
  });

  it('harmonic-minor ABCs raise their 7th degree (carry a ^ or = accidental)', () => {
    const harm = DRILLS.filter((d) => d.family === 'harmonic-minor');
    for (const d of harm) {
      const notes = d.abc.split('\n').pop() ?? '';
      expect(notes).toMatch(/[\^=]/);
    }
  });

  it('melodic-minor ABCs raise both 6th and 7th (at least two accidentals)', () => {
    const mel = DRILLS.filter((d) => d.family === 'melodic-minor');
    for (const d of mel) {
      const notes = d.abc.split('\n').pop() ?? '';
      const matches = notes.match(/[\^=]/g);
      expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('chord ABCs render as a bracketed block ([...]) rather than a melodic line', () => {
    const chords = DRILLS.filter((d) => d.family === 'major-chord' || d.family === 'minor-chord');
    for (const d of chords) {
      const notes = d.abc.split('\n').pop() ?? '';
      expect(notes.trim()).toMatch(/^\[[A-Ga-g,'^_=]+\]\d* \|$/);
    }
  });

  it('keeps comfort, bpm, and reps within plausible bounds', () => {
    for (const d of DRILLS) {
      expect(d.comfort).toBeGreaterThanOrEqual(0);
      expect(d.comfort).toBeLessThanOrEqual(1);
      expect(d.bpmTarget).toBeGreaterThan(0);
      expect(d.bpmCurrent).toBeGreaterThan(0);
      expect(d.bpmCurrent).toBeLessThanOrEqual(d.bpmTarget);
      expect(d.reps).toBeGreaterThanOrEqual(0);
    }
  });

  it('DRILL_BY_ID maps every id back to its drill', () => {
    for (const d of DRILLS) expect(DRILL_BY_ID.get(d.id)?.id).toBe(d.id);
  });
});

describe('DAILY_ROUTINE_IDS', () => {
  it('references only real drill ids', () => {
    const ids = new Set(DRILLS.map((d) => d.id));
    for (const id of DAILY_ROUTINE_IDS) expect(ids.has(id)).toBe(true);
  });

  it('has at least 5 entries (a meaningful warmup spanning families)', () => {
    expect(DAILY_ROUTINE_IDS.length).toBeGreaterThanOrEqual(5);
  });

  it('includes a mix of scales, arpeggios, and chords', () => {
    const byId = new Map(DRILLS.map((d) => [d.id, d]));
    const families = new Set(DAILY_ROUTINE_IDS.map((id) => byId.get(id)?.family));
    const scaleFams: TechniqueFamily[] = ['major', 'natural-minor', 'harmonic-minor', 'melodic-minor'];
    const arpFams: TechniqueFamily[] = ['major-arpeggio', 'minor-arpeggio'];
    const chordFams: TechniqueFamily[] = ['major-chord', 'minor-chord'];
    expect(scaleFams.some((f) => families.has(f))).toBe(true);
    expect(arpFams.some((f) => families.has(f))).toBe(true);
    expect(chordFams.some((f) => families.has(f))).toBe(true);
  });
});
