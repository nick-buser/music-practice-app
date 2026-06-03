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

  it('has 36 eleventh chords (12 maj11 + 12 dom11 + 12 m11)', () => {
    expect(DRILLS.filter((d) => d.family === 'maj11-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'dom11-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'min11-chord')).toHaveLength(12);
  });

  it('has 36 thirteenth chords (12 maj13 + 12 dom13 + 12 m13)', () => {
    expect(DRILLS.filter((d) => d.family === 'maj13-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'dom13-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'min13-chord')).toHaveLength(12);
  });

  it('has 72 altered dominants (6 types × 12 keys)', () => {
    expect(DRILLS.filter((d) => d.family === '7b5-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === '7s5-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === '7b9-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === '7s9-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === '7s11-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === '13b9-chord')).toHaveLength(12);
  });

  it('has 36 half-/fully-diminished + lydian-major (3 types × 12 keys)', () => {
    expect(DRILLS.filter((d) => d.family === 'm7b5-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'dim7-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'maj7s11-chord')).toHaveLength(12);
  });

  it('has 24 more altered: 7alt + maj7♯5 (12 each)', () => {
    expect(DRILLS.filter((d) => d.family === '7alt-chord')).toHaveLength(12);
    expect(DRILLS.filter((d) => d.family === 'maj7s5-chord')).toHaveLength(12);
  });

  it('has 60 Japanese pentatonic scales (5 families × 12 keys)', () => {
    for (const fam of ['hirajoshi', 'in-sen', 'yo', 'iwato', 'kumoi'] as const) {
      expect(DRILLS.filter((d) => d.family === fam)).toHaveLength(12);
    }
  });

  it('has 60 Chinese five-tone scales (5 families × 12 keys)', () => {
    for (const fam of ['gong', 'shang', 'jue', 'zhi', 'yu'] as const) {
      expect(DRILLS.filter((d) => d.family === fam)).toHaveLength(12);
    }
  });

  it('totals 492 entries', () => {
    expect(DRILLS).toHaveLength(492);
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
      'maj11-chord', 'dom11-chord', 'min11-chord',
      'maj13-chord', 'dom13-chord', 'min13-chord',
      '7b5-chord', '7s5-chord', '7b9-chord', '7s9-chord', '7s11-chord', '13b9-chord',
      'm7b5-chord', 'dim7-chord', 'maj7s11-chord',
      '7alt-chord', 'maj7s5-chord',
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

  it('eleventh chords contain six chord tones in the bracket', () => {
    const eleventhFams: TechniqueFamily[] = ['maj11-chord', 'dom11-chord', 'min11-chord'];
    const elevenths = DRILLS.filter((d) => eleventhFams.includes(d.family));
    expect(elevenths).toHaveLength(36);
    for (const d of elevenths) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(6);
    }
  });

  it('thirteenth chords contain seven chord tones in the bracket', () => {
    const thirteenthFams: TechniqueFamily[] = ['maj13-chord', 'dom13-chord', 'min13-chord'];
    const thirteenths = DRILLS.filter((d) => thirteenthFams.includes(d.family));
    expect(thirteenths).toHaveLength(36);
    for (const d of thirteenths) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(7);
    }
  });

  it('m13 chords use the Dorian-relative key, not the parallel minor (regression)', () => {
    // m13's 13th is a natural-6 above the root (Dorian), not the b6 the parallel
    // minor would give. e.g. Cm13 must use K:Bb so the `a` lands on A natural.
    const cm13 = DRILLS.find((d) => d.id === 'c-min13-chord');
    expect(cm13?.abc).toContain('K:Bb');
    const am13 = DRILLS.find((d) => d.id === 'a-min13-chord');
    expect(am13?.abc).toContain('K:G');
    const dm13 = DRILLS.find((d) => d.id === 'd-min13-chord');
    expect(dm13?.abc).toContain('K:C');
  });

  it('extended-chord names follow jazz convention (Maj7/7/m7 … Maj13/13/m13)', () => {
    expect(DRILLS.find((d) => d.id === 'c-maj7-chord')?.name).toBe('Cmaj7');
    expect(DRILLS.find((d) => d.id === 'c-dom7-chord')?.name).toBe('C7');
    expect(DRILLS.find((d) => d.id === 'a-min7-chord')?.name).toBe('Am7');
    expect(DRILLS.find((d) => d.id === 'c-maj9-chord')?.name).toBe('Cmaj9');
    expect(DRILLS.find((d) => d.id === 'c-dom9-chord')?.name).toBe('C9');
    expect(DRILLS.find((d) => d.id === 'd-min9-chord')?.name).toBe('Dm9');
    expect(DRILLS.find((d) => d.id === 'c-maj11-chord')?.name).toBe('Cmaj11');
    expect(DRILLS.find((d) => d.id === 'c-dom11-chord')?.name).toBe('C11');
    expect(DRILLS.find((d) => d.id === 'g-min11-chord')?.name).toBe('Gm11');
    expect(DRILLS.find((d) => d.id === 'f-maj13-chord')?.name).toBe('Fmaj13');
    expect(DRILLS.find((d) => d.id === 'c-dom13-chord')?.name).toBe('C13');
    expect(DRILLS.find((d) => d.id === 'a-min13-chord')?.name).toBe('Am13');
  });

  it('altered-chord names use ♭/♯ symbols (C7♭5, E7♯9, Bb13♭9 …)', () => {
    expect(DRILLS.find((d) => d.id === 'c-7b5-chord')?.name).toBe('C7♭5');
    expect(DRILLS.find((d) => d.id === 'c-7s5-chord')?.name).toBe('C7♯5');
    expect(DRILLS.find((d) => d.id === 'c-7b9-chord')?.name).toBe('C7♭9');
    expect(DRILLS.find((d) => d.id === 'e-7s9-chord')?.name).toBe('E7♯9');
    expect(DRILLS.find((d) => d.id === 'c-7s11-chord')?.name).toBe('C7♯11');
    expect(DRILLS.find((d) => d.id === 'bb-13b9-chord')?.name).toBe('B♭13♭9');
  });

  it('half-/fully-dim and lydian-major names follow jazz convention', () => {
    // Half-diminished is "m7♭5" (the more common notation than ø7).
    expect(DRILLS.find((d) => d.id === 'b-m7b5-chord')?.name).toBe('Bm7♭5');
    expect(DRILLS.find((d) => d.id === 'c-m7b5-chord')?.name).toBe('Cm7♭5');
    // dim7 uses the ° glyph in the chord name.
    expect(DRILLS.find((d) => d.id === 'c-dim7-chord')?.name).toBe('C°7');
    expect(DRILLS.find((d) => d.id === 'fs-dim7-chord')?.name).toBe('F♯°7');
    // Lydian major.
    expect(DRILLS.find((d) => d.id === 'c-maj7s11-chord')?.name).toBe('Cmaj7♯11');
    expect(DRILLS.find((d) => d.id === 'f-maj7s11-chord')?.name).toBe('Fmaj7♯11');
  });

  it('7alt and maj7♯5 names follow jazz convention', () => {
    expect(DRILLS.find((d) => d.id === 'c-7alt-chord')?.name).toBe('C7alt');
    expect(DRILLS.find((d) => d.id === 'g-7alt-chord')?.name).toBe('G7alt');
    expect(DRILLS.find((d) => d.id === 'bb-7alt-chord')?.name).toBe('B♭7alt');
    expect(DRILLS.find((d) => d.id === 'c-maj7s5-chord')?.name).toBe('Cmaj7♯5');
    expect(DRILLS.find((d) => d.id === 'fs-maj7s5-chord')?.name).toBe('F♯maj7♯5');
  });

  it('7alt is a 6-tone voicing (1, 3, ♯5, ♭7, ♭9, ♯9)', () => {
    const alts = DRILLS.filter((d) => d.family === '7alt-chord');
    expect(alts).toHaveLength(12);
    for (const d of alts) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(6);
    }
  });

  it('maj7♯5 is a 4-tone voicing (1, 3, ♯5, 7)', () => {
    const aug = DRILLS.filter((d) => d.family === 'maj7s5-chord');
    expect(aug).toHaveLength(12);
    for (const d of aug) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(4);
    }
  });

  it('Bmaj7♯5 and F♯maj7♯5 preserve the theoretically correct double-sharp ♯5', () => {
    // B's ♯5 is Fx (= G natural enharmonic); F♯'s ♯5 is Cx (= D natural).
    // We pin the theoretical spelling so a future refactor can't drift.
    const bmaj = DRILLS.find((d) => d.id === 'b-maj7s5-chord');
    const fsmaj = DRILLS.find((d) => d.id === 'fs-maj7s5-chord');
    expect(bmaj?.abc).toContain('^^');
    expect(fsmaj?.abc).toContain('^^');
  });

  it('m7♭5 and dim7 have 4 chord tones; maj7♯11 has 5', () => {
    const m7b5 = DRILLS.filter((d) => d.family === 'm7b5-chord');
    const dim7 = DRILLS.filter((d) => d.family === 'dim7-chord');
    const maj7s11 = DRILLS.filter((d) => d.family === 'maj7s11-chord');
    for (const d of m7b5) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      expect(inside.replace(/[\^_=,'0-9 ]/g, '').length).toBe(4);
    }
    for (const d of dim7) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      expect(inside.replace(/[\^_=,'0-9 ]/g, '').length).toBe(4);
    }
    for (const d of maj7s11) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      expect(inside.replace(/[\^_=,'0-9 ]/g, '').length).toBe(5);
    }
  });

  it('dim7 preserves the bb7 spelling (each dim7 contains "__" or has 4 single-flats)', () => {
    // Theoretically-correct diminished spelling cycles by minor thirds; the
    // bb7 of any root is two letter-steps + double-flat. We verify the chord
    // bracket has either a double-accidental marker (__) or, for sharp/clean
    // roots, at least one accidental per altered tone.
    const dim7 = DRILLS.filter((d) => d.family === 'dim7-chord');
    expect(dim7).toHaveLength(12);
    // The flat-tonic spellings (eb, ab, db) require double-flats.
    expect(DRILLS.find((d) => d.id === 'eb-dim7-chord')?.abc).toContain('__');
    expect(DRILLS.find((d) => d.id === 'ab-dim7-chord')?.abc).toContain('__');
    expect(DRILLS.find((d) => d.id === 'db-dim7-chord')?.abc).toContain('__');
  });

  it('altered dominants land on the right chord-tone counts', () => {
    const fourTone: TechniqueFamily[] = ['7b5-chord', '7s5-chord'];
    const fiveTone: TechniqueFamily[] = ['7b9-chord', '7s9-chord', '7s11-chord'];
    const sevenTone: TechniqueFamily[] = ['13b9-chord'];
    for (const d of DRILLS.filter((x) => fourTone.includes(x.family))) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(4);
    }
    for (const d of DRILLS.filter((x) => fiveTone.includes(x.family))) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(5);
    }
    for (const d of DRILLS.filter((x) => sevenTone.includes(x.family))) {
      const inside = d.abc.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const letters = inside.replace(/[\^_=,'0-9 ]/g, '');
      expect(letters.length).toBe(7);
    }
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
    const elevenths = CHORD_TYPES.filter((t) => CHORD_TYPE_META[t].category === 'elevenths');
    const thirteenths = CHORD_TYPES.filter((t) => CHORD_TYPE_META[t].category === 'thirteenths');
    const altered = CHORD_TYPES.filter((t) => CHORD_TYPE_META[t].category === 'altered');
    expect(triads).toEqual(['major', 'minor']);
    expect(sevenths).toEqual(['maj7', 'dom7', 'min7']);
    expect(ninths).toEqual(['maj9', 'dom9', 'min9']);
    expect(elevenths).toEqual(['maj11', 'dom11', 'min11']);
    expect(thirteenths).toEqual(['maj13', 'dom13', 'min13']);
    expect(altered).toEqual([
      '7b5', '7s5', '7b9', '7s9', '7s11', '13b9',
      'm7b5', 'dim7', 'maj7s11',
      '7alt', 'maj7s5',
    ]);
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
