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

/* ─── Pull the existing chord engravings out of drills.ts ──────────── */

/** Every chord drill, by id, with its hand-typed K signature + block measure. */
const HAND_TYPED = new Map<string, { key: string; measure: string }>();
for (const d of DRILLS as Drill[]) {
  if (!d.family.endsWith('-chord')) continue;
  const lines = d.abc.split('\n');
  const key = lines.find((l) => l.startsWith('K:'))!.slice(2);
  const measure = lines[lines.length - 1].trim();
  HAND_TYPED.set(d.id, { key, measure });
}

const CATALOG = chordDrillCatalog();

/* ─── The documented divergences (the user's "Canonical + document the 58") ─
 *
 * The principled generator emits clean, root-position, theory-correct
 * engravings. These 58 chords differ from the hand-typed strings shipping in
 * drills.ts today — not because the model is wrong, but because the hand data
 * made non-systematic choices. Each will become a deliberate, reviewed
 * engraving change when PR 2 flips drills.ts onto the model. Categories:
 *
 *   low-root-voicing    — A/A♭/F roots whose 3rd & 5th were written *below* the
 *                         root (e.g. A major as C♯4-E4-A4). The model voices
 *                         root-position (A4-C♯5-E5). No single octave rule
 *                         reproduces the hand data: B-rooted chords beside them
 *                         are already root-position, so the choice is irregular.
 *   enharmonic-9        — 7♯9 in e/b/f♯ used a plain ♯ where the ♯9 is really a
 *                         double-sharp; in b♭/e♭ it was spelled as a natural 9.
 *                         The model spells the theory-correct ♯9.
 *   courtesy-accidental — 7alt within-chord natural handling. The hand data is
 *                         self-contradictory (adds the courtesy natural for some
 *                         keys, omits it for others); the model is consistent.
 *   enharmonic-respell  — 7alt in A♭/D♭ respelled B♭♭→A, C♭→B to dodge stacked
 *                         double-flats. The model keeps the theory spelling.
 *   octave-double-flat  — D♭°7's double-flat tones placed an octave higher by
 *                         hand; the model voices them ascending from the root.
 */
const KNOWN_DIVERGENCES: Record<string, string> = {};
const mark = (cat: string, ids: string[]) => ids.forEach((id) => (KNOWN_DIVERGENCES[id] = cat));

mark('low-root-voicing', [
  'a-major-chord', 'ab-major-chord', 'a-minor-chord', 'ab-minor-chord',
  'a-maj7-chord', 'f-maj7-chord', 'ab-maj7-chord',
  'a-dom7-chord', 'f-dom7-chord', 'ab-dom7-chord',
  'a-min7-chord', 'f-min7-chord', 'ab-min7-chord',
  'a-maj9-chord', 'ab-maj9-chord', 'a-dom9-chord', 'ab-dom9-chord', 'a-min9-chord', 'ab-min9-chord',
  'a-7b5-chord', 'f-7b5-chord', 'ab-7b5-chord',
  'a-7s5-chord', 'f-7s5-chord', 'ab-7s5-chord',
  'a-7b9-chord', 'f-7b9-chord', 'ab-7b9-chord',
  'a-7s9-chord', 'f-7s9-chord', 'ab-7s9-chord',
  'a-7s11-chord', 'f-7s11-chord', 'ab-7s11-chord',
  'a-13b9-chord', 'f-13b9-chord', 'ab-13b9-chord',
  'a-m7b5-chord', 'f-m7b5-chord', 'ab-m7b5-chord',
  'a-dim7-chord',
  'a-maj7s11-chord', 'f-maj7s11-chord', 'ab-maj7s11-chord',
  'a-maj7s5-chord', 'f-maj7s5-chord', 'ab-maj7s5-chord',
]);
mark('enharmonic-9', ['e-7s9-chord', 'b-7s9-chord', 'fs-7s9-chord', 'bb-7s9-chord', 'eb-7s9-chord']);
mark('courtesy-accidental', ['a-7alt-chord', 'b-7alt-chord', 'eb-7alt-chord']);
mark('enharmonic-respell', ['ab-7alt-chord', 'db-7alt-chord']);
mark('octave-double-flat', ['db-dim7-chord']);

/* ─── Catalog ↔ drills coverage ───────────────────────────────────── */

describe('chord catalog', () => {
  it('mirrors the chord-type list in drills.ts', () => {
    expect([...CHORD_TYPE_IDS]).toEqual([...CHORD_TYPES]);
  });

  it('covers exactly the chord drills in drills.ts (300, same ids)', () => {
    const catalogIds = new Set(CATALOG.map((e) => e.id));
    const drillIds = new Set(HAND_TYPED.keys());
    expect(catalogIds).toEqual(drillIds);
    expect(CATALOG).toHaveLength(300);
  });
});

/* ─── Key-signature parity (all 300) ──────────────────────────────── */

describe('chordKey', () => {
  it('picks the exact key signature drills.ts uses, for all 300 chords', () => {
    const mismatches = CATALOG.filter(
      (e) => chordKey(e.identity) !== HAND_TYPED.get(e.id)!.key,
    ).map((e) => `${e.id}: got ${chordKey(e.identity)} want ${HAND_TYPED.get(e.id)!.key}`);
    expect(mismatches).toEqual([]);
  });
});

/* ─── ABC engraving parity ────────────────────────────────────────── */

describe('toAbc parity with hand-typed drills.ts', () => {
  const matches: string[] = [];
  const diverges: string[] = [];
  for (const e of CATALOG) {
    (toAbcMeasure(e.identity) === HAND_TYPED.get(e.id)!.measure ? matches : diverges).push(e.id);
  }

  it('reproduces every non-divergent chord engraving exactly (242)', () => {
    const unexpected = matches
      .filter((id) => id in KNOWN_DIVERGENCES); // a "match" we'd flagged as divergent
    expect(unexpected).toEqual([]);

    const broken = CATALOG
      .filter((e) => !(e.id in KNOWN_DIVERGENCES))
      .filter((e) => toAbcMeasure(e.identity) !== HAND_TYPED.get(e.id)!.measure)
      .map((e) => `${e.id}: got ${toAbcMeasure(e.identity)} want ${HAND_TYPED.get(e.id)!.measure}`);
    expect(broken).toEqual([]);

    expect(matches).toHaveLength(242);
  });

  it('every documented divergence really does differ (the list cannot go stale)', () => {
    // If the model or data changes so a "divergence" now matches, force the
    // maintainer to update KNOWN_DIVERGENCES rather than silently passing.
    const nowMatching = Object.keys(KNOWN_DIVERGENCES).filter(
      (id) => toAbcMeasure(CATALOG.find((e) => e.id === id)!.identity)
        === HAND_TYPED.get(id)!.measure,
    );
    expect(nowMatching).toEqual([]);
    expect(diverges.sort()).toEqual(Object.keys(KNOWN_DIVERGENCES).sort());
  });

  it('accounts for all 300 chords (242 exact + 58 documented)', () => {
    expect(matches.length + diverges.length).toBe(300);
    expect(Object.keys(KNOWN_DIVERGENCES)).toHaveLength(58);
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
    ['c-maj7-chord', 'major 7 · 1 · 3 · 5 · 7'],
    ['c-dom7-chord', 'dominant 7 · 1 · 3 · 5 · ♭7'],
    ['a-min7-chord', 'minor 7 · 1 · ♭3 · 5 · ♭7'],
    ['c-dim7-chord', 'fully diminished 7 · 1 · ♭3 · ♭5 · ♭♭7'],
    ['c-m7b5-chord', 'half-diminished 7 · 1 · ♭3 · ♭5 · ♭7'],
    ['c-7s11-chord', 'dominant 7 ♯11 · 1 · 3 · 5 · ♭7 · ♯11'],
    ['c-13b9-chord', 'dominant 13 ♭9 · 1 · 3 · 5 · ♭7 · ♭9 · 11 · 13'],
    ['c-7alt-chord', 'fully altered dominant · 1 · 3 · ♯5 · ♭7 · ♭9 · ♯9'],
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
