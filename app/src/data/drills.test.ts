import { describe, expect, it } from 'vitest';
import { Drill, type TechniqueFamily } from './schemas';
import {
  CHORD_CATEGORIES,
  CHORD_TYPE_META,
  CHORD_TYPES,
  DAILY_ROUTINE_IDS,
  DRILLS,
  DRILL_BY_ID,
} from './drills';

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

  it('has 24 triad chords (12 major + 12 minor, root position)', () => {
    expect(DRILLS.filter((d) => d.family === 'major-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'minor-chord')).toHaveLength(12);
  });

  it('has 36 seventh chords (12 maj7 + 12 dom7 + 12 m7)', () => {
    expect(DRILLS.filter((d) => d.family === 'maj7-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'dom7-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'min7-chord')).toHaveLength(12);
  });

  it('has 36 ninth chords (12 maj9 + 12 dom9 + 12 m9)', () => {
    expect(DRILLS.filter((d) => d.family === 'maj9-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'dom9-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'min9-chord')).toHaveLength(12);
  });

  it('totals 168 entries', () => {
    expect(DRILLS).toHaveLength(168);
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

  it('all chord ABCs render as a bracketed block ([...]) rather than a melodic line', () => {
    const chordFams: TechniqueFamily[] = [
      'major-chord', 'minor-chord',
      'maj7-chord', 'dom7-chord', 'min7-chord',
      'maj9-chord', 'dom9-chord', 'min9-chord',
    ];
    const chords = DRILLS.filter((d) => chordFams.includes(d.family));
    for (const d of chords) {
      const notes = d.abc.split('\n').pop() ?? '';
      expect(notes.trim()).toMatch(/^\[[A-Ga-g,'^_=]+\]\d* \|$/);
    }
  });

  it('seventh chords contain four chord tones in the bracket', () => {
    const seventhFams: TechniqueFamily[] = ['maj7-chord', 'dom7-chord', 'min7-chord'];
    const sevenths = DRILLS.filter((d) => seventhFams.includes(d.family));
    expect(sevenths).toHaveLength(36);
    for (const d of sevenths) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(4);
    }
  });

  it('ninth chords contain five chord tones in the bracket', () => {
    const ninthFams: TechniqueFamily[] = ['maj9-chord', 'dom9-chord', 'min9-chord'];
    const ninths = DRILLS.filter((d) => ninthFams.includes(d.family));
    expect(ninths).toHaveLength(36);
    for (const d of ninths) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(5);
    }
  });

  it('7th- and 9th-chord names follow jazz convention (Maj7 / 7 / m7, Maj9 / 9 / m9)', () => {
    expect(DRILLS.find((d) => d.id === 'c-maj7-chord')?.name).toBe('Cmaj7');
    expect(DRILLS.find((d) => d.id === 'c-dom7-chord')?.name).toBe('C7');
    expect(DRILLS.find((d) => d.id === 'a-min7-chord')?.name).toBe('Am7');
    expect(DRILLS.find((d) => d.id === 'c-maj9-chord')?.name).toBe('Cmaj9');
    expect(DRILLS.find((d) => d.id === 'c-dom9-chord')?.name).toBe('C9');
    expect(DRILLS.find((d) => d.id === 'd-min9-chord')?.name).toBe('Dm9');
  });

  it('C#m7 voices the 7th in the same octave as the rest of the chord (regression)', () => {
    // Pre-existing bug fixed in this PR: ABC was [CEGb]4 which placed B5 a
    // full octave above the G#4, leaving a gap in the stack.
    const cs = DRILLS.find((d) => d.id === 'cs-min7-chord');
    expect(cs?.abc.endsWith('[CEGB]4 |')).toBe(true);
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

describe('chord-type taxonomy', () => {
  it('every chord type maps to a real TechniqueFamily', () => {
    const familiesPresent = new Set(DRILLS.map((d) => d.family));
    for (const t of CHORD_TYPES) {
      const meta = CHORD_TYPE_META[t];
      expect(familiesPresent.has(meta.family)).toBe(true);
    }
  });

  it('every chord type sits in a known category', () => {
    const catIds = new Set(CHORD_CATEGORIES.map((c) => c.id));
    for (const t of CHORD_TYPES) {
      expect(catIds.has(CHORD_TYPE_META[t].category)).toBe(true);
    }
  });

  it('each chord category has the expected members', () => {
    const triads = CHORD_TYPES.filter((t) => CHORD_TYPE_META[t].category === 'triads');
    const sevenths = CHORD_TYPES.filter((t) => CHORD_TYPE_META[t].category === 'sevenths');
    const ninths = CHORD_TYPES.filter((t) => CHORD_TYPE_META[t].category === 'ninths');
    expect(triads).toEqual(['major', 'minor']);
    expect(sevenths).toEqual(['maj7', 'dom7', 'min7']);
    expect(ninths).toEqual(['maj9', 'dom9', 'min9']);
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
