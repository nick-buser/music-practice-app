import { describe, expect, it } from 'vitest';
import { DRILLS, CHORD_TYPES } from './drills';
import type { Drill } from './schemas';
import {
  chordDrillCatalog,
  buildChordIdentity,
  CHORD_TYPE_IDS,
  MAJOR_ROOTS,
} from './chord-catalog';
import {
  chordKey,
  chordTones,
  displayName,
  subtitleLine,
  toAbcMeasure,
  toMidi,
} from './chord-identity';

/* ─── drills.ts is now generated from the model ─────────────────────
 *
 * As of this PR the chord engravings in drills.ts are produced by `toAbc`,
 * not hand-typed. These tests verify the wiring (every chord drill renders
 * from its identity) and pin the engraving changes this migration adopted —
 * the "Canonical + document the 58" decision made in the model PR.
 */

const CATALOG = chordDrillCatalog();

/** Chord drills as drills.ts ships them now: id → { key, measure }. */
const DRILL_CHORDS = new Map<string, { key: string; measure: string }>();
for (const d of DRILLS as Drill[]) {
  if (!d.family.endsWith('-chord')) continue;
  const lines = d.abc.split('\n');
  DRILL_CHORDS.set(d.id, {
    key: lines.find((l) => l.startsWith('K:'))!.slice(2),
    measure: lines[lines.length - 1].trim(),
  });
}

/**
 * The 58 engravings this migration changed from the original hand-typed
 * strings, pinned to the model's canonical output. Categories (see the model
 * PR): A/A♭/F low voicings → root position; 7♯9 → theory-correct ♯9; 7alt
 * courtesy accidentals made consistent; 7alt A♭/D♭ theory spelling kept; D♭°7
 * voiced ascending from the root.
 */
const ADOPTED_ENGRAVINGS: Record<string, string> = {
  // low-root-voicing: 3rd & 5th now sit above the root (root position)
  'a-major-chord': '[Acea]4 |', 'ab-major-chord': '[Acea]4 |',
  'a-minor-chord': '[Acea]4 |', 'ab-minor-chord': '[Acea]4 |',
  'a-maj7-chord': '[Aceg]4 |', 'f-maj7-chord': '[FAce]4 |', 'ab-maj7-chord': '[Aceg]4 |',
  'a-dom7-chord': '[Aceg]4 |', 'f-dom7-chord': '[FAce]4 |', 'ab-dom7-chord': '[Aceg]4 |',
  'a-min7-chord': '[Aceg]4 |', 'f-min7-chord': '[FAce]4 |', 'ab-min7-chord': '[Aceg]4 |',
  'a-maj9-chord': '[Acegb]4 |', 'ab-maj9-chord': '[Acegb]4 |',
  'a-dom9-chord': '[Acegb]4 |', 'ab-dom9-chord': '[Acegb]4 |',
  'a-min9-chord': '[Acegb]4 |', 'ab-min9-chord': '[Acegb]4 |',
  'a-7b5-chord': '[Ac_eg]4 |', 'f-7b5-chord': '[FA_ce]4 |', 'ab-7b5-chord': '[Ac__eg]4 |',
  'a-7s5-chord': '[Ac^eg]4 |', 'f-7s5-chord': '[FA^ce]4 |', 'ab-7s5-chord': '[Ac=eg]4 |',
  'a-7b9-chord': '[Aceg_b]4 |', 'f-7b9-chord': '[FAce_g]4 |', 'ab-7b9-chord': '[Aceg__b]4 |',
  'a-7s9-chord': '[Aceg^b]4 |', 'f-7s9-chord': '[FAce^g]4 |', 'ab-7s9-chord': '[Aceg=b]4 |',
  'a-7s11-chord': "[Aceg^d']4 |", 'f-7s11-chord': '[FAce=b]4 |', 'ab-7s11-chord': "[Aceg=d']4 |",
  'a-13b9-chord': "[Aceg_bd'f']4 |", 'f-13b9-chord': "[FAce_gbd']4 |", 'ab-13b9-chord': "[Aceg__bd'f']4 |",
  'a-m7b5-chord': '[Ac_eg]4 |', 'f-m7b5-chord': '[FA_ce]4 |', 'ab-m7b5-chord': '[Ac__eg]4 |',
  'a-dim7-chord': '[Ac_e_g]4 |',
  'a-maj7s11-chord': "[Aceg^d']4 |", 'f-maj7s11-chord': '[FAce=b]4 |', 'ab-maj7s11-chord': "[Aceg=d']4 |",
  'a-maj7s5-chord': '[Ac^eg]4 |', 'f-maj7s5-chord': '[FA^ce]4 |', 'ab-maj7s5-chord': '[Ac=eg]4 |',
  // enharmonic-9: the ♯9 spelled theory-correct (double-sharp / true ♯9)
  'e-7s9-chord': '[EGBd^^f]4 |', 'b-7s9-chord': "[Bdfa^^c']4 |", 'fs-7s9-chord': '[FAce^^g]4 |',
  'bb-7s9-chord': "[Bdfa^c']4 |", 'eb-7s9-chord': '[EGBd^f]4 |',
  // courtesy-accidental: consistent within-chord naturals
  'a-7alt-chord': "[A^c^eg_b=c']4 |", 'b-7alt-chord': "[B^d^^fac'=d']4 |", 'eb-7alt-chord': '[_EGB_d_f_g]4 |',
  // enharmonic-respell: theory spelling kept (no enharmonic dodge)
  'ab-7alt-chord': "[_Ace_g__b_c']4 |", 'db-7alt-chord': '[_DFA_c__e_f]4 |',
  // octave-double-flat: voiced ascending from the root
  'db-dim7-chord': '[_D_F__A__c]4 |',
};

/* ─── Catalog ↔ drills coverage ───────────────────────────────────── */

describe('chord catalog', () => {
  it('mirrors the chord-type list in drills.ts', () => {
    expect([...CHORD_TYPE_IDS]).toEqual([...CHORD_TYPES]);
  });

  it('covers exactly the chord drills in drills.ts (300, same ids)', () => {
    expect(new Set(CATALOG.map((e) => e.id))).toEqual(new Set(DRILL_CHORDS.keys()));
    expect(CATALOG).toHaveLength(300);
  });
});

/* ─── drills.ts is wired to the model ─────────────────────────────── */

describe('drills.ts chord engravings come from the model', () => {
  it('renders every chord drill from its identity (measure + key)', () => {
    const broken = CATALOG
      .filter((e) => {
        const d = DRILL_CHORDS.get(e.id)!;
        return d.measure !== toAbcMeasure(e.identity) || d.key !== chordKey(e.identity);
      })
      .map((e) => e.id);
    expect(broken).toEqual([]);
  });

  it('adopted the canonical engraving for the 58 formerly hand-tuned chords', () => {
    expect(Object.keys(ADOPTED_ENGRAVINGS)).toHaveLength(58);
    const wrong = Object.entries(ADOPTED_ENGRAVINGS)
      .filter(([id, measure]) => DRILL_CHORDS.get(id)!.measure !== measure)
      .map(([id, measure]) => `${id}: got ${DRILL_CHORDS.get(id)!.measure} want ${measure}`);
    expect(wrong).toEqual([]);
  });

  it('leaves the well-behaved engravings unchanged (spot checks)', () => {
    expect(DRILL_CHORDS.get('c-major-chord')!.measure).toBe('[CEGc]4 |');
    expect(DRILL_CHORDS.get('c-maj7-chord')!.measure).toBe('[CEGB]4 |');
    expect(DRILL_CHORDS.get('cs-min7-chord')!.measure).toBe('[CEGB]4 |');
    expect(DRILL_CHORDS.get('g-major-chord')!.measure).toBe('[GBdg]4 |');
  });
});

/* ─── Derivation-function unit tests ──────────────────────────────── */

function identityFor(id: string) {
  return CATALOG.find((e) => e.id === id)!.identity;
}

describe('chordTones / toMidi', () => {
  it('spells a C major block triad as C4 E4 G4 C5', () => {
    const tones = chordTones(identityFor('c-major-chord'));
    expect(tones.map((t) => `${t.letter}${t.octave}`)).toEqual(['C4', 'E4', 'G4', 'C5']);
    expect(toMidi(identityFor('c-major-chord'))).toEqual([60, 64, 67, 72]);
  });

  it('spells Cmaj7 as C4 E4 G4 B4 (no octave double)', () => {
    expect(toMidi(identityFor('c-maj7-chord'))).toEqual([60, 64, 67, 71]);
  });

  it('keeps the diminished-7 spelling stacked in minor thirds (C°7 = C E♭ G♭ B♭♭)', () => {
    const tones = chordTones(identityFor('c-dim7-chord'));
    expect(tones.map((t) => `${t.letter}${t.alter}`)).toEqual(['C0', 'E-1', 'G-1', 'B-2']);
  });
});

describe('displayName', () => {
  const cases: Array<[string, string]> = [
    ['c-major-chord', 'C'], ['a-minor-chord', 'Am'],
    ['c-maj7-chord', 'Cmaj7'], ['c-dom7-chord', 'C7'], ['a-min7-chord', 'Am7'],
    ['c-maj9-chord', 'Cmaj9'], ['c-dom9-chord', 'C9'], ['d-min9-chord', 'Dm9'],
    ['c-maj11-chord', 'Cmaj11'], ['c-dom11-chord', 'C11'], ['g-min11-chord', 'Gm11'],
    ['f-maj13-chord', 'Fmaj13'], ['c-dom13-chord', 'C13'], ['a-min13-chord', 'Am13'],
    ['c-7b5-chord', 'C7♭5'], ['c-7s5-chord', 'C7♯5'], ['c-7b9-chord', 'C7♭9'],
    ['e-7s9-chord', 'E7♯9'], ['c-7s11-chord', 'C7♯11'], ['bb-13b9-chord', 'B♭13♭9'],
    ['b-m7b5-chord', 'Bm7♭5'], ['c-dim7-chord', 'C°7'], ['fs-dim7-chord', 'F♯°7'],
    ['c-maj7s11-chord', 'Cmaj7♯11'], ['f-maj7s11-chord', 'Fmaj7♯11'],
    ['c-7alt-chord', 'C7alt'], ['bb-7alt-chord', 'B♭7alt'],
    ['c-maj7s5-chord', 'Cmaj7♯5'], ['fs-maj7s5-chord', 'F♯maj7♯5'],
  ];
  it.each(cases)('%s → %s', (id, name) => {
    expect(displayName(identityFor(id))).toBe(name);
  });
});

describe('subtitleLine', () => {
  const cases: Array<[string, string]> = [
    ['c-major-chord', 'major triad · 1 · 3 · 5'],
    ['a-minor-chord', 'minor triad · 1 · ♭3 · 5'],
    ['c-maj7-chord', 'major 7 · 1 · 3 · 5 · 7'],
    ['c-dom7-chord', 'dominant 7 · 1 · 3 · 5 · ♭7'],
    ['a-min7-chord', 'minor 7 · 1 · ♭3 · 5 · ♭7'],
    ['f-maj13-chord', 'major 13 · 1 · 3 · 5 · 7 · 9 · 11 · 13'],
    ['c-7b5-chord', 'altered dominant · 1 · 3 · ♭5 · ♭7'],
    ['e-7s9-chord', 'altered dominant · 1 · 3 · 5 · ♭7 · ♯9'],
    ['c-7s11-chord', 'lydian dominant · 1 · 3 · 5 · ♭7 · ♯11'],
    ['c-13b9-chord', 'dominant 13 ♭9 · 1 · 3 · 5 · ♭7 · ♭9 · 11 · 13'],
    ['c-m7b5-chord', 'half-diminished 7 · 1 · ♭3 · ♭5 · ♭7'],
    ['c-dim7-chord', 'fully diminished 7 · 1 · ♭3 · ♭5 · ♭♭7'],
    ['c-maj7s11-chord', 'lydian major · 1 · 3 · 5 · 7 · ♯11'],
    ['c-7alt-chord', 'fully altered dominant · 1 · 3 · ♯5 · ♭7 · ♭9 · ♯9'],
    ['c-maj7s5-chord', 'augmented major 7 · 1 · 3 · ♯5 · 7'],
  ];
  it.each(cases)('%s → %s', (id, line) => {
    expect(subtitleLine(identityFor(id))).toBe(line);
  });
});

describe('buildChordIdentity', () => {
  it('produces JSON-serialisable identities (DB-column ready)', () => {
    const id = buildChordIdentity('maj7', MAJOR_ROOTS[0].root);
    expect(JSON.parse(JSON.stringify(id))).toEqual(id);
  });
});
