# Sight-reading generation: difficulty, taxonomy, generation, calibration

> **Reviewed 2026-09-02 (F2) — taxonomy v2.** Adversarial pass over the
> taxonomy, the difficulty model, generation, assessment and calibration
> from the standpoint of a piano pedagogue, the generator that must satisfy
> every ceiling, the scorer that must compute every rung, the MIDI matcher
> and a psychometrician, followed by a six-lens critic pass over the amended
> text (cross-doc consistency, SR1 implementability, preset satisfiability).
> The ladders were re-cut (15 dimensions, four per hand), every rung names
> the feature condition that reaches it, the L1–L10 presets exist as a
> table closed under the coupling rules, and the matcher, attribution and
> calibrator are specified rather than named. The end of the doc lists what
> changed and why. SR1 is seeded from this version. Thresholds marked
> *provisional* are calibration-subject and change under `taxonomyVersion`.

Sight-reading books fail structurally. A book is a few hundred static
exercises in difficulty order: the ones at your level run out in days, the
rest are too easy or too hard, and the book is exhausted on first use. The
product goal is the thing a book cannot be — **effectively infinite,
properly leveled, technique-targeted material**, tuned to the player it's in
front of. Piano first; the design keeps other instruments reachable by
construction.

The system is three separable engines around one shared vocabulary:

```
              ┌──────────────┐   spec    ┌───────────┐  ScoreDoc  ┌──────────┐
   ability ──▶│  calibrator  │──────────▶│ generator │───────────▶│  scorer  │──▶ accept/re-roll
   estimate   └──────────────┘           └───────────┘            └──────────┘
        ▲                                                               │
        │            ┌─────────────┐        attempt result              │ feature vector
        └────────────│  assessment │◀──── (MIDI capture) ◀── player ◀───┘ (verified difficulty)
                     └─────────────┘
```

- The **scorer** measures a score's demands: ScoreDoc → feature vector →
  per-dimension difficulty. Pure, deterministic, versioned.
- The **generator** produces exercises to a spec: (versions, spec, seed) →
  ScoreDoc. Deterministic — the recipe *is* the exercise.
- The **calibrator** turns attempt outcomes into a per-dimension ability
  estimate and picks the next spec. This is the adaptive loop.

The shared vocabulary — the **technique taxonomy** — is the real design
surface. Get it wrong and every exercise downstream is miscalibrated in a
way no test suite catches; that is why this doc exists before any code.

Everything here consumes [score-substrate.md](score-substrate.md): exercises
are native ScoreDocs, assessment verdicts are a virtual system layer on
exact notehead ids, expected timing derives from `soundingEvents(doc)` (the
substrate's tie-merged, chord-collapsed timeline, in quarter-note units),
and hand assignment comes from `StaffDef.hand`, never from clef or staff
index.

## The technique taxonomy (piano v2)

A **dimension** is an independently practicable skill with an ordinal ladder
of **rungs**. Dimensions are the contract between all three engines and the
UI. Each rung names the feature condition that reaches it — these are the
boundaries SR1's fixtures pin. Four dimensions are **per hand** (`.rh` /
`.lh`), because a serious amateur commonly reads treble fluently and bass
poorly, and the vector must be able to say so. The set grows by evidence,
not by completeness.

Two key types: `DimId` is the 15-entry taxonomy key (`'pitch.ledger'`);
`DimKey` is the hand-resolved key — the `DimId` for non-per-hand dimensions,
`` `${DimId}.rh` | `${DimId}.lh` `` for the four per-hand ones — 19 values,
`DIM_KEYS: readonly DimKey[]` in taxonomy order. `TAXONOMY: Record<DimId, {
label; group; perHand; rungs: { key; label; description }[] }>` (`group` is
an explicit field, not the key prefix — `texture.*` belongs to the Hands
group); every runtime vector (`Spec.dims`, `FeatureVector.dims`,
`Observation.scored`, `noteTags`, `AttributionEntry.dimension`) is
`Record<DimKey, …>`, and `type RungVector = Record<DimKey, number | null>`.
`dimIdOf(key)` / `handOf(key)` split a `DimKey`; rung keys are per `DimId`
and hand-independent.

| Key | Label | Ladder (low → high; rung keys in `taxonomy.ts`) |
|---|---|---|
| `pitch.key` | Key signature | K1 C major → K2 G, F major → K3 D, B♭ major; A minor → K4 A, E♭ major; E, D minor → K5 E, A♭ major; B, G minor → K6 B, D♭ major; F♯, C minor → K7 F♯/G♭, C♯/C♭ major; C♯, G♯, F, B♭, D♯/E♭, A♭ minor. A minor key sits two rungs above its relative major, capped at K7 (the leading-note accidental plus the modal reading); the table is the data — `KEY_RUNG` in `taxonomy.ts` is a lookup keyed by `(fifths, mode)` that reproduces this cell exactly, and a fixture pins every minor key. Rung is by signature and mode, never by the accidentals in the notes; a mid-exercise key change scores K7 from that measure on. |
| `pitch.accidentals` | Accidentals | A1 none → A2 the raised 6̂/7̂ of the minor key (any count), or a single chromatic neighbour approached and left by step → A3 chromatic passing/neighbour tones in either hand; an accidental governing a second note later in the bar; cancelling naturals → A4 accidentals inside chords; secondary-dominant chromaticism; accidentals in both hands within one beat → A5 double sharps/flats, enharmonic respellings, chromatic-scale fragments. Feature = *written* accidentals as the serializer prints them (`accidentalState()`), **excluding** cautionary ones (`courtesy: true`) — a courtesy glyph lowers difficulty and is never counted. The minor key's own raised 6̂/7̂ never count as `inChord` or `bothHandsSameBeat`, so V and vii° in minor stay at A2. |
| `pitch.ledger.rh` / `.lh` | Ledger lines (per hand) | G1 notes on the staff plus middle C (its single ledger line is exempt) → G2 one ledger line above treble (A5, B5) or below bass (E2, D2) → G3 two ledger lines (C6 / C2); bass-clef notes above middle C or treble-clef notes below it → G4 three or more ledger lines. Evaluated in the clef actually printed for that staff. |
| `pitch.clef` | Clef | C1 RH treble and LH bass, unchanged → C2 any other clef assignment for the whole exercise (both hands in one clef, or swapped) → C3 one clef change in one hand at a phrase boundary → C4 clef changes mid-phrase or in both hands. C3–C4 are **model-gated**: ScoreDoc v1 has no clef-change event; presets stop at C2 until the substrate grows. |
| `rhythm.values` | Note values | V1 whole, half, dotted half, quarter and their rests → V2 + eighths in beamed pairs/fours starting on the beat → V3 + dotted quarter–eighth; quarter tied to quarter or eighth; eighth rests → V4 + eighth-note triplets in simple meter; sixteenths in groups on the beat → V5 + dotted eighth–sixteenth, eighth–two-sixteenths and two-sixteenths–eighth; sixteenth rests → V6 + syncopated sixteenths; quarter-note triplets in simple meter; duplets/quadruplets in compound meter; double dots → V7 + 32nds, irregular tuplets (5:4, 7:8). V7 is beyond L10: any V7 content is a ceiling breach at every level. Values are *written* (ties do not merge) and classed by subdivision level relative to `beatUnit`; classes are named by their 4/4 spelling (§Operational definitions). The dotted value that equals a whole bar or a whole beat in the current meter is **dotted-native** and does not raise the rung; in compound meter eighths are the subdivision, so 6/8 starts at V2; in 2/2 a bar of eighths is V4 and a sixteenth is V7. |
| `rhythm.meter` | Meter | M1 4/4, 3/4, 2/4 → M2 6/8 (felt in two), 3/8 → M3 2/2 (cut), 9/8, 12/8 → M4 5/4, 7/4 with constant grouping → M5 5/8, 7/8, or any time-signature change inside the exercise. M5 is scorable in ScoreDoc v1 (`TimeSig.grouping` and per-measure `timeSig` changes exist); the metronome accent schedule for 5/8 and 7/8 is an SR5 criterion and does not gate the rung. |
| `rhythm.syncopation` | Syncopation | S1 none → S2 a note held through the barline or through a stronger beat (an on-beat onset sustained across it; by tie or by value) → S3 offbeat quarters in simple meter (eighth–quarter–eighth: an off-beat onset sustained through the next beat); entries after an on-beat eighth rest → S4 sustained offbeat eighths across successive beats; a repeating syncopated cell; syncopation in both hands → S5 sixteenth-level syncopation; hemiola in 3/4 or 6/8; 3-against-2 between the hands. Computed on the rational timeline from onsets and tie-merged durations against the beat grid — never from `tie` fields, so `h` on beat 2 and two tied quarters score the same. |
| `rhythm.rests` | Rests | R1 whole-bar rests; rests of a quarter or longer on strong beats at phrase ends → R2 quarter rests on any beat; eighth rests on the offbeat (the note simply releases) → R3 eighth rests on the beat with the entry on the offbeat; rests in both hands simultaneously mid-phrase → R4 sixteenth rests; rests inside a beamed group; a downbeat rest in one hand while the other plays. Eighth rests are a V3 value class and sixteenth rests V5 (coupling). An on-beat rest with an offbeat entry also counts toward S3. Voices with no notes in the measure contribute nothing. |
| `hands.together` | Hands together | H1 one hand plays for the whole exercise (`spec.hands` says which) → H2 hands alternate, hand-offs at bar boundaries, never simultaneous → H3 one hand sustains (exactly 1 onset in the bar) while the other moves → H4 homorhythm (identical onset sets, parallel or contrary motion) → H5 RH busier: the LH onset set is a proper subset of the RH's with a constant per-beat ratio (RH eighths over LH quarters/halves) → H6 LH busier (the RH onset set is a proper subset of the LH's: Alberti/broken chords under a sustained melody), or a non-constant ratio → H7 independent (neither onset set contains the other). Per-measure relation from onset sets (tie continuations and rests excluded); H1 is exercise-level. 3-against-2 lives in S5 only. |
| `hands.lh_pattern` | Left-hand pattern | P1 single held notes/drones (whole-bar) → P2 held dyads (5ths, 6ths, 3rds), one per bar → P3 single-note stepwise LH line in quarters/halves → P4 block root-position triads ≤ 2 per bar; broken chords in quarters (root–5th–3rd, root–5th–octave); waltz bass (root + chord) → P5 Alberti and broken chords in eighths; block chords on every beat → P6 scalar/walking bass in eighths; role swap (LH melody, RH accompaniment) → P7 independent contrapuntal voice. A held fifth per bar is read as one shape; a moving line is read note by note — hence P2 before P3. Scored by a classifier over the LH staff (definitions in §Operational definitions); a measure matching no class scores P7. `null` when `hands.together` ≤ H2. |
| `texture.density.rh` / `.lh` | Chords & intervals (per hand) | D1 single line → D2 dyads at ≤ 1 per bar (a held dyad, or one at a phrase end) → D3 dyads on most beats; octaves → D4 block root-position triads, ≤ 2 chords per bar → D5 ≥ 3 chords per bar or a chord on every beat; a chord (size ≥ 3) in both hands at one onset → D6 4-note chords (7ths, added notes). Inversion reading is gated by the chord pool (§Generation), not by density. Features per hand: max simultaneous notes, chords per bar, harmonic-interval classes, chord span. |
| `texture.voices` | Voices per hand | X1 one voice per staff → X2 two voices in one hand, one of them sustained (held note under/over a moving line) → X3 two rhythmically independent voices in one hand. |
| `motion.intervals.rh` / `.lh` | Leaps (per hand) | I1 repeated notes and steps → I2 + 3rds (skips within the position, triadic) → I3 + 4ths and 5ths within a five-finger position → I4 + 6ths by stretch; 7ths and octaves (a shift under the hand model) → I5 + leaps greater than an octave; `bothHandsLeapSameBeat`. A leap is Δ ≥ 3 staff steps (a 4th); `bothHandsLeapSameBeat` = both hands move Δ ≥ 5 (a 6th or more) at the same onset by different intervals or in different directions — parallel and contrary motion by the same interval (H4 homorhythm) is one shape and does not count. Interval = Δ staff steps between consecutive onsets in the same voice (rests skipped; chords use the RH top / LH bottom note); no cross-hand intervals; an interval is owned by the measure of its target onset. |
| `motion.position.rh` / `.lh` | Hand position (per hand) | Q1 one five-finger position for the whole exercise → Q2 an extended position (any stretch) or exactly one shift in the exercise, at a phrase boundary → Q3 one shift per 4-bar window, all in `shiftContext` (a phrase boundary, after a rest, or after a note ≥ a half) → Q4 scalar passages beyond five notes (thumb-under), or any shift outside `shiftContext`, or more than one shift per window → Q5 shifts in both hands inside one bar; repositioning leaps (a shift whose leap is > an octave). Hand model in §Operational definitions. Hand crossing is *not* a rung (it is deferred); the scorer reports a `crossing` boolean feature. |
| `motion.patterns` | Pattern reading | T1 ≥ 0.70 of notes belong to a recognised pattern (a scale fragment of ≥ 4 stepwise notes in one direction; a broken-chord/arpeggio fragment of ≥ 3 chord tones; an exact or sequential repeat of a ≥ 1-bar cell) → T2 [0.30, 0.70) → T3 < 0.30 (non-patterned). Exercise-level, per hand fraction as an exact rational, min over hands. A bar of thirds that spells a broken triad is read as one shape; a bar of unrelated thirds is read note by note — this is the primary sight-reading skill and it needs a rung. |

Groups for the UI: **Pitch** (key, accidentals, ledger, clef), **Rhythm**
(values, meter, syncopation, rests), **Hands** (together, lh_pattern,
density, voices), **Motion** (intervals, position, patterns). UI copy is
`${label} → ${rungLabel}`, never the key or the index. A player is not
"L4"; they are "K5, I3 in the left hand, L4 everything else," and
generation targets exactly that shape. Per-dimension L badges are derived
from the preset table: `levelFor(d, rung)` = the *lowest* level whose
ceiling for `d` is ≥ the rung (undefined for a rung no preset reaches).
Other instruments arrive later as a different dimension set over the same
machinery, not a fork.

**Not dimensions, by decision:** tempo (a preset parameter checked at
verify, below), exercise length (a preset parameter), harmonic vocabulary (a
generator pool gated by `pitch.accidentals` and mode), hand crossing
(deferred), dynamics/articulation reading (emitted, unscored — see
§Coherence C7 and §Deliberately not yet), pedaling.

### Level presets (provisional)

A **level** (L1–L10) is a named preset: a bundle of per-dimension rung
ceilings plus the parameters that are not dimensions. Levels are UI sugar —
**the system's real state is the per-dimension vector** — but presets are
how a player places themselves, how the manual override reads, and what
the calibrator's prior comes from. Anchoring to ABRSM sight-reading
parameters is from memory and must be checked against the printed syllabus
table before the first calibration pass; the table is data in
`taxonomy.ts` and every cell change is a `taxonomyVersion` bump. Ceilings
are maxima; see the preset-expansion rule for how many an exercise may touch.

| Level | Anchor | Bars | Beat bpm band / shortest-value floor | K | A | G | C | V | M | S | R | H | P | D.rh | D.lh | X | I | Q | T |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | pre-Grade 1 | 4–8 | 60–84 / 300 ms | K1 | A1 | G1 | C1 | V1 | M1 | S1 | R1 | H1 | – | D1 | D1 | X1 | I1 | Q1 | T1 |
| L2 | ≈ ABRSM 1 | 8 | 66–92 / 300 | K2 | A1 | G1 | C1 | V2 | M1 | S1 | R2 | H2 | – | D1 | D1 | X1 | I2 | Q1 | T1 |
| L3 | ≈ 2 | 8 | 69–96 / 280 | K3 | A2 | G2 | C1 | V3 | M1 | S2 | R2 | H4 | P2 | D2 | D2 | X1 | I3 | Q2 | T1 |
| L4 | ≈ 3 | 8 | 72–100 / 200 | K4 | A3 | G2 | C1 | V4 | M2 | S2 | R2 | H5 | P4 | D2 | D4 | X1 | I3 | Q3 | T2 |
| L5 | ≈ 4 | 8–12 | 76–108 / 190 | K5 | A3 | G3 | C2 | V5 | M3 | S3 | R3 | H5 | P4 | D3 | D4 | X1 | I4 | Q4 | T2 |
| L6 | ≈ 5 | 12 | 80–116 / 180 | K6 | A4 | G3 | C2 | V5 | M3 | S3 | R3 | H6 | P5 | D4 | D5 | X2 | I4 | Q4 | T2 |
| L7 | ≈ 6 | 12–16 | 84–120 / 160 | K6 | A4 | G4 | C2 | V6 | M4 | S4 | R4 | H6 | P6 | D5 | D5 | X2 | I4 | Q4 | T3 |
| L8 | ≈ 7 | 16 | 88–126 / 140 | K7 | A4 | G4 | C2 | V6 | M4 | S4 | R4 | H7 | P6 | D5 | D6 | X2 | I5 | Q5 | T3 |
| L9 | ≈ 8 | 16 | 92–132 / 125 | K7 | A5 | G4 | C2 | V6 | M5 | S5 | R4 | H7 | P7 | D6 | D6 | X3 | I5 | Q5 | T3 |
| L10 | post-Grade 8 | 16–24 | 96–144 / 110 | K7 | A5 | G4 | C2 | V6 | M5 | S5 | R4 | H7 | P7 | D6 | D6 | X3 | I5 | Q5 | T3 |

Reading the table: a single column for a per-hand dimension is the ceiling
of both hands; `LEVELS[l].ceilings` is a `Partial<RungVector>` over the 19
keys with the D column split and the G/I/Q cells duplicated. `–` means the
dimension is **omitted** from the preset (no ceiling; the null rule governs
it — `hands.lh_pattern` is absent at L1–L2 because H ≤ H2 forces it null);
the invariant reads "no preset sets an *explicit* ceiling of `null`, a
model-gated rung, or V7", and for the non-decreasing check an absent cell
counts as 0.

Parameters per level: **tempo band** in `tempo.unit` bpm (= `beatUnit`, the
number the metronome clicks); verify compares `tempo.bpm`, never the
quarter-note figure; in compound meter the shortest-value floor is
multiplied by 2/3 (the compound eighth is beat/3). The generator sets
`tempo.bpm` to the highest band value at which the candidate's
`shortestValueMs` clears the floor — a sixteenth-bearing candidate runs
near the band's bottom, a quarters-and-eighths candidate at the top — and
verify rejects only when no band tempo clears it. **Harmonic rhythm** one
chord per bar (L1–L4), per half bar (L5–L6), per beat allowed in cadence
bars (L7+), where "half" = beats 1 and 3 in 4/4, beats 1 and 2 in 2/4 and
6/8, and in 3/4 beat 1 with an optional change on beat 3 (never mid-beat).
**Chord pool** follows the `pitch.accidentals` ceiling (§Generation).
**Count-in** two bars at L1–L2 and in every compound meter, one bar
otherwise. **Anacrusis** allowed from L3 (one beat at L3–L4, up to half a
bar from L5), with `measures[0].pickup` and `Measure.complement` on the
final bar. **Hands**: at L1 the session alternates RH-only and LH-only
2:1; from L2 `hands: 'both'` is the default, and the session policy's
LH-only exercise at L ≤ 4 is the stated exception (it scores H1 with every
`.rh` dimension and `hands.lh_pattern` null). **R2 at L2** is reached by
quarter rests only (eighth rests arrive with V3 at L3). Invariants,
test-enforced: ceilings are non-decreasing from Ln to Ln+1 in every
dimension; at least one ceiling or parameter strictly increases per step;
L1–L2 are major-only; every level's ceiling vector is a fixpoint of the
coupling closure; no preset sets a model-gated rung or V7.

### Coupling rules and spec normalization

Dimensions are practicable independently, but rungs imply each other, and
a spec that ignores that is unsatisfiable — re-rolling can never fix it. The
implications are data in `taxonomy.ts`:

```ts
interface CouplingRule {
  id: string;
  if:   { dim: DimKey | 'key.mode' | 'hands'; op: '>=' | '<=' | '=='; value: number | string };
  then: { dim: DimKey; op: '>=' | '<=' | 'null'; value?: number };
}
```

| id | If | Then | Why |
|---|---|---|---|
| minor-accid | `key.mode == 'minor'` | `pitch.accidentals ≥ A2` | the raised 7th is a written accidental |
| a1-major | `pitch.accidentals ≤ A1` | key is major; chord pool tier 1 | "none" means none anywhere |
| lh-hands | `hands.lh_pattern ≥ P1` | `hands.together ≥ H3` | a pattern needs a second hand |
| p3-hands | `hands.lh_pattern ≥ P3` | `hands.together ≥ H4` | a moving line has ≥ 2 onsets per bar |
| p5-hands | `hands.lh_pattern ≥ P5` | `hands.together ≥ H6` | figuration is busier than the melody |
| p2-density | `hands.lh_pattern ≥ P2` | `texture.density.lh ≥ D2` | held dyads |
| p4-density | `hands.lh_pattern ≥ P4` | `texture.density.lh ≥ D4` | block triads / waltz bass |
| p5-density | `hands.lh_pattern ≥ P5` | `texture.density.lh ≥ D5` | block chords per beat |
| h2-null | `hands.together ≤ H2` | `hands.lh_pattern` = null | there is no second hand |
| h1-hands | `hands == 'rh' \| 'lh'` | `hands.together` = H1 and the silent hand's keys null | |
| s3-values | `rhythm.syncopation ≥ S3` | `rhythm.values ≥ V2` | an offbeat needs a sub-beat |
| s5-values | `rhythm.syncopation ≥ S5` | `rhythm.values ≥ V4` | 3-against-2 needs triplets |
| r2-values | `rhythm.rests ≥ R2` | `rhythm.values ≥ V3` when reached by an eighth rest (L2 uses quarter rests only) | an eighth rest is a V3 class |
| r3-sync | `rhythm.rests ≥ R3` | `rhythm.syncopation ≥ S3` | an offbeat entry is the same reading demand |
| r4-values | `rhythm.rests ≥ R4` | `rhythm.values ≥ V5` | sixteenth rests |
| compound-values | `rhythm.meter` ∈ {M2, M3 compound} | `rhythm.values ≥ V2` | eighths are the subdivision |
| i4-position | `motion.intervals.{h} ≥ I4` | `motion.position.{h} ≥ Q3` | a 7th or octave re-anchors the window |
| i5-position | `motion.intervals.{h} ≥ I5` | `motion.position.{h} ≥ Q5` | a leap beyond an octave repositions the hand |
| ledger-position | `pitch.ledger.{h} ≥ G3` | `motion.position.{h} ≥ Q2` | two ledger lines are an extended-position skill |

Notes that are not rules: `pitch.clef ≥ C2` means `pitch.ledger` is
evaluated in the printed clef; D3 octaves and I4 stretches respect the
hand-span invariant (≤ an octave in each hand, a scorer check at every
level); duplets in compound meter are V6.

**Derived dimensions.** `pitch.key`, `rhythm.meter` and the H1 case of
`hands.together` are determined by `spec.key`, `spec.meter` and
`spec.hands`: `normalizeSpec` overwrites `dims['pitch.key']` with
`{ target: KEY_RUNG[fifthsOf(spec.key)][spec.key.mode], mode: 'comfort' }`,
`dims['rhythm.meter']` with the M rung of `spec.meter`, and, when
`spec.hands ≠ 'both'`, `dims['hands.together']` with `{ target: 1 }`; a
caller-supplied value that disagrees is a `SpecInvalid` error, not a
relaxation. A level preset expands these from its chosen key and meter.

**`normalizeSpec(spec) → EffectiveSpec | SpecUnsatisfiable | SpecInvalid`**
is a pure function inside `generatorVersion`: floors = focus targets (1
elsewhere), ceilings = comfort/focus targets; iterate rules in table order
and dimensions in `DIM_KEYS` order — a `>=` consequent raises a floor, a
`<=` consequent lowers a ceiling, `null` sets both to null — and repeat to
a fixpoint (floors only rise, ceilings only fall, so it terminates). Then
for each dimension with floor > ceiling, or a null forced onto a non-null
target: a non-focus dimension adopts the closed value and appends
`{ dim, from, to, rule: id }` to `relaxationTrace`; a focus dimension makes
the spec unsatisfiable — `{ ok: false, kind: 'unsatisfiable', rule, dims }`
— which the calibrator must never emit and the manual-override UI reports
by rule. `SpecInvalid` covers > 3 focus dimensions, two from one group, a
disagreeing derived dimension, or a `null` target on a focus dimension.
`EffectiveSpec = { spec, floor: RungVector, ceiling: RungVector, focus:
DimKey[], relaxationTrace }`. Only after normalization does rolling start.

**A spec is a per-dimension pair `{ target: number | null, mode: 'focus' |
'comfort' }`** (`null` only where the null rule applies, never on a focus
dimension). Focus dimensions (1–3, never two from one group) must land
exactly on `target`; comfort dimensions must not exceed it. A level preset
expands to a spec by choosing at most three dimensions at their ceiling as
focus and setting every other dimension to `max(ceiling − 1, the floor the
coupling table closes from the focus targets)`, floor 1 — so preset
expansion never produces a relaxation entry, and exam-style tests push one
or two parameters while the rest sit a grade lower. The calibrator's
`edge` is the rung above comfort (§Calibration).

## The difficulty model: transparent features, no ML

The scorer extracts objective features per dimension from a ScoreDoc, maps
each to a rung by the operational definitions below, and reports the
vector. An overall scalar (for sorting and display) is a normalized weighted
aggregate — but the vector is the product surface and the contract.

Deliberately **not** a learned model, for now: there is no training data,
and a learned scalar would be exactly the un-inspectable "grade 3-ish"
judgment we don't trust books for. The transparent scorer is testable
(hand-scored fixture exercises pin every rung boundary) and arguable — when
an exercise feels harder than its label, a specific rung mapping is wrong
and fixable. Meanwhile every attempt this system ever sees is logged, which
is precisely the corpus a learned difficulty model would need — the option
stays open at zero design cost (with one caveat: see §Calibration on IRT).

The one rule that protects trust: **no dimension may exceed its ceiling in
any owning unit of an accepted exercise.** A "L3" exercise with one L6
measure is how the player learns to distrust the labels. The scorer
enforces ceilings per owning unit — measure, 4-bar window, or exercise as
the definitions say — never on averages.

### Operational definitions (scorer v1)

**Shared definitions.**

- *Hand*: `StaffDef.hand` (RH = `staves[0]` in generated exercises). A
  ScoreDoc with a staff count other than 2 is not scorable under the piano
  set: the scorer returns `{ scorable: false, reason }`.
- *Onset*: a `SoundingEvent` from the substrate's `soundingEvents(doc)` —
  tie-merged (a `tie: 'stop' | 'both'` note is never an onset and never a
  leap target), chord-collapsed (one onset, N pitches), rest-free.
  `rhythm.values` and `texture.density` read *written* events (ties do not
  merge, because you read every notehead); every other dimension reads
  onsets and tie-merged spans.
- *Position*: `TimelineEvent.beat` (0-based from the measure's notated
  start, quarter-note units); the scorer right-aligns a pickup with
  `meter − pickupLength + beat`. *Beat grid*: `beatUnit(timeSig)` from the
  substrate (dotted quarter in compound meter). *Subdivision level* of a
  written duration relative to the beat: 0 if ≥ beat; 1 if ≥ beat/2
  (simple) or beat/3 (compound); 2 if ≥ beat/4 or beat/6; 3 finer.
- *Beat strength*: 4/4 and 2/2: 1 > 3 > 2, 4; 2/4, 3/4, 3/8: 1 only; 6/8:
  1 > 2; 9/8, 12/8: 1 > others; 5/x, 7/x: 1 > the first beat of each
  `grouping` member.
- *Staff step* = 7 × octave + index(step); interval and every span in this
  doc are Δ staff steps — an octave = 7, a 6th = 5, a 5th = 4 — because
  sight-reading reads staff distance, not semitones. *Leap* = Δ ≥ 3.
- *Ledger lines* of a pitch on its staff's printed clef = the number of
  ledger lines drawn: above the staff `⌊Δ from the top line / 2⌋`, below
  `⌊Δ from the bottom line / 2⌋`, so A5 and B5 in treble are 1, C6 and D6
  are 2; C4 is 0 in both clefs.
- *Written accidental*: what `accidentalState()` prints, excluding
  `courtesy` glyphs.
- *Syncopated onset*: an onset off the beat whose tie-merged span crosses
  the next beat boundary. *Held-through*: an on-beat onset whose span
  crosses a stronger beat. *bothHands*: a syncopated or held-through onset
  in each hand within one measure. *syncCellRepeats*: the same one-beat
  onset pattern containing a syncopated onset occurs ≥ 2 times in the
  measure or in consecutive measures. *threeAgainstTwo*: within one beat,
  one hand has ≥ 2 tuplet-3 onsets and the other ≥ 2 duple onsets.
  *hemiola*: in a triple meter, the onset pattern of two consecutive
  measures forms three equal two-beat spans (3/4) or three equal spans
  across 6/8.
- *Run*: ≥ n consecutive onsets in one voice with no intervening rest;
  `thumbUnderRun` = a run of ≥ 6 with every Δ = ±1 in one direction;
  `chromaticRunLen` = the longest run with every |Δ midi| = 1 (counted in
  notes; ≥ 3 triggers A5); `neighbourStepApproached` = the single
  accidental-bearing note of the measure is preceded and followed in its
  voice by a step.
- *Phrase end*: measure index `i` (pickup excluded from the count) with
  `(i + 1) mod 4 = 0`, plus the last measure; *phrase boundary* = the
  downbeat of the measure after a phrase end; *mid-phrase* = any other
  measure. This grid is used for every dimension that names phrases; the
  sliding *window* (every run of 4 consecutive measures, stride 1; a
  window's rung is assigned to every measure it covers) is used only for
  window-owned features. Authored and imported scores have no phrase
  markers; the same index rule applies to them.
- *Hand model (piano)*: a hand's window is the five diatonic steps
  `[anchor, anchor + 4]` anchored at its lowest sounding note; a note at
  Δ 5 above the window is a *stretch* and does not move it; any note beyond
  re-anchors the window at that note and counts as one *shift*, owned by
  that note's measure; `shiftContext` is a shift at a phrase boundary,
  after a rest, or after a note ≥ a half. A chord may stretch to Δ ≤
  `maxHandSpan` (5 | 6 | 7, default 7 = an octave — the hand-span
  invariant; chords beyond it are rejected at verify at every level).
  *Crossing*: an LH onset above the RH's lowest sounding note or vice
  versa — reported, not a rung. Fingering is ignored by the scorer so
  generated, authored and imported scores score identically.
- *Rung selection*: every rung's mapping is a trigger; the unit's rung is
  the highest rung whose trigger holds, with rung 1 as the default; a bound
  written `≤ n` on rung k is the trigger `value > bound of rung k−1`. Where
  a lower rung is a special case of a higher one, the lower rung's trigger
  carries the exclusion and wins (A2 vs A3, H3 vs H4, D2 vs D3).
- *Per-voice aggregation*: features are computed per voice with ≥ 1 note in
  the measure, then aggregated within the hand by max (rung-monotone
  features) or sum (counts feeding a threshold); `texture.voices` is the
  only feature that looks across voices.
- *Arithmetic*: exact rationals everywhere (the substrate's `Fraction`);
  floats appear only in the overall scalar.

**Per-dimension table** (thresholds provisional; every `≤` inclusive; a
fixture pair pins each boundary). *Tags* = the noteheads the dimension
instantiates at rung ≥ 2 (§Note tags).

| Dimension | Features | Owner | Rung mapping | Tags |
|---|---|---|---|---|
| `pitch.key` | `fifths`, `mode` from the effective KeySig; `keyChanges` | exercise (measure after a change) | `KEY_RUNG[fifths][mode]`; a change → K7 from that measure | every note whose letter is altered by the signature |
| `pitch.accidentals` | `writtenPerMeasure` (both hands), `leadingNoteOnly`, `neighbourStepApproached`, `inChord`, `bothHandsSameBeat`, `doubleAccidental`, `chromaticRunLen` (the minor key's raised 6̂/7̂ are exempt from `inChord`/`bothHandsSameBeat`) | measure | A1 none · A2 `leadingNoteOnly` (any count), or `writtenPerMeasure` = 1 and `neighbourStepApproached` · A3 ≤ 3, none `inChord`, not A2 · A4 > 3, or `inChord`, or `bothHandsSameBeat` · A5 `doubleAccidental` or `chromaticRunLen` ≥ 3 | the accidental-bearing note |
| `pitch.ledger.{rh,lh}` | `maxLedger` in the printed clef; `crossStaffRegister` (bass-clef note above C4 / treble below) | measure | G1 0 · G2 1 · G3 2 or `crossStaffRegister` · G4 ≥ 3 | notes with ≥ 1 ledger line or `crossStaffRegister` |
| `pitch.clef` | `StaffDef.clef` per hand; clef events (none in v1) | exercise | C1 RH treble and LH bass · C2 any other assignment · C3–C4 model-gated | every note in a non-native clef |
| `rhythm.values` | `maxSubdivLevel` (written, per voice); `patternClasses` ⊆ { dotted-below-beat, tied-within-bar, eighth-rest (a rest at level 1), eighth-triplet, level2-group (≥ 2 consecutive level-2 events inside one beat starting on a level-1 boundary), dotted-level1-pair (dotted level-1 + level-2, either order), sixteenth-rest (a rest at level 2), level2-syncopated (a level-2 onset whose span crosses a level-1 boundary), quarter-triplet, duplet, double-dot, level3, irregular-tuplet }; dotted-native values never contribute | measure | V1 level 0, no classes · V2 level ≤ 1, no classes · V3 + dotted-below-beat / tied-within-bar / eighth-rest · V4 + eighth-triplet / level2-group · V5 + dotted-level1-pair / sixteenth-rest · V6 + level2-syncopated / quarter-triplet / duplet / double-dot · V7 + level3 / irregular-tuplet | every written event at the level or class that set the measure's rung |
| `rhythm.meter` | class of the effective TimeSig; `sigChanges`; `meterUnclassified` | measure; `sigChanges` exercise | M1 {4/4, 3/4, 2/4} · M2 {6/8, 3/8} · M3 {2/2, 9/8, 12/8} · M4 {5/4, 7/4} · M5 {5/8, 7/8}, any other signature (`meterUnclassified`), or `sigChanges` > 0 | every onset (M ≥ 2) |
| `rhythm.syncopation` | `heldThrough`, `offbeatSustain`, `offbeatEntryAfterRest`, `consecutiveOffbeat`, `syncCellRepeats`, `bothHands`, `sixteenthSync`, `hemiola`, `threeAgainstTwo` | measure (a barline-crossing span counts against both measures) | S1 all 0 · S2 `heldThrough` only · S3 `offbeatSustain` or `offbeatEntryAfterRest` · S4 `consecutiveOffbeat` ≥ 2, `syncCellRepeats`, or `bothHands` · S5 `sixteenthSync`, `hemiola`, or `threeAgainstTwo` | the syncopated or held-through onset |
| `rhythm.rests` | per voice with notes: `restOnStrongBeatOnly`, `quarterRestAnyBeat`, `offbeatEighthRest`, `onBeatRestOffbeatEntry`, `bothHandsRestMidPhrase`, `sixteenthRest`, `restInBeamGroup` (a rest inside a group returned by the substrate's `groupBeams`), `downbeatRestOneHand` | measure | R1 whole-bar or strong-beat quarter+ rests only · R2 `quarterRestAnyBeat` or `offbeatEighthRest` · R3 `onBeatRestOffbeatEntry` or `bothHandsRestMidPhrase` · R4 `sixteenthRest`, `restInBeamGroup`, or `downbeatRestOneHand` | the first onset after the qualifying rest |
| `hands.together` | onset-position sets `RH`, `LH` per measure; `relation` ∈ one-hand (a hand has no onsets in the measure) / sustain (the sparser hand has exactly 1 onset) / aligned (`RH = LH`) / rh-superset (`LH ⊊ RH`, constant per-beat ratio) / lh-superset (`RH ⊊ LH`) / mixed (`LH ⊊ RH`, non-constant ratio) / independent; `constantRatio` | measure; H1 exercise | H1 one hand has no onsets in the whole exercise (every `perMeasure` entry 1) · H2 a `one-hand` measure in an exercise that is not H1 · H3 `sustain` · H4 `aligned` · H5 `rh-superset` · H6 `lh-superset` or `mixed` · H7 `independent` | every onset in the measure (H ≥ 3) |
| `hands.lh_pattern` | LH per measure: `onsets`, `maxChord`, `distinctPitches`, `period` (shortest cycle in onsets after which the pitch sequence repeats within the measure), `stepFraction`, `roleSwap` (the RH measure matches P3–P5 as if it were the LH while the LH has more onsets than the RH with `maxChord` = 1 — the only feature that reads both staves); *broken chord* = single-note onsets, `distinctPitches` ≤ 4, all pitches of one triad or seventh; *block triad* = an onset with `maxChord` ≥ 3; *waltz bass* = onset 1 a single note and every later onset a dyad/chord, one cycle per bar; *walking bass* = single notes at level 1, `stepFraction` ≥ 0.5, `distinctPitches` ≥ 4 | measure; null at H1–H2 | P1 onsets ≤ 1, single note · P2 `maxChord` = 2, onsets ≤ 2 · P3 single line, `stepFraction` ≥ 0.5, quarters/halves · P4 block triads ≤ 2 per bar, or broken chord in quarters, or waltz bass · P5 broken chord in eighths (`period` ≤ 4), or block chords on every beat · P6 walking bass in eighths, or `roleSwap` · P7 otherwise | every LH onset in the measure |
| `texture.density.{rh,lh}` | per hand: `chordSize` per onset, `dyadsPerBar`, `chordsPerBar` (onsets of size ≥ 2 whose pitch set differs from the previous size-≥2 onset in the same hand, the previous bar's last chord included), `intervalClasses`, `chordSpan`, `chordsBothHandsSameBeat` (size ≥ 3 in both hands at one onset) | measure | D1 max 1 · D2 max 2, `dyadsPerBar` ≤ 1 · D3 max 2 otherwise, or any octave dyad · D4 max 3, `chordsPerBar` ≤ 2 · D5 max 3 with `chordsPerBar` ≥ 3 or a chord on every beat, or `chordsBothHandsSameBeat` · D6 max ≥ 4 | the chord or dyad |
| `texture.voices` | `activeVoices` per staff; `bothVoicesMoving` | measure | X1 1 · X2 2 with one sustained · X3 2, both moving | every onset of the second voice |
| `motion.intervals.{rh,lh}` | `maxStep` between consecutive onsets in one voice; `bothHandsLeapSameBeat`; `intervalHistogram[0..8+]` | measure (an interval is owned by its target's measure) | I1 ≤ 1 · I2 ≤ 2 · I3 ≤ 4 · I4 ≤ 7 · I5 ≥ 8 or `bothHandsLeapSameBeat` | the leap target |
| `motion.position.{rh,lh}` | `shifts` (hand model), `stretch`, `shiftContext`, `thumbUnderRun`, `bothHandsShiftSameBar`, `repositionLeap` (a shift whose leap is Δ ≥ 8) | shifts: 4-bar window; others: measure | Q1 0 shifts, no stretch · Q2 any stretch, or exactly 1 shift in the exercise, at a phrase boundary · Q3 ≤ 1 shift per window, all in `shiftContext` · Q4 `thumbUnderRun`, or any shift outside `shiftContext`, or > 1 shift per window · Q5 `bothHandsShiftSameBar` or `repositionLeap` | the onset that shifts, or the stretched chord |
| `motion.patterns` | per hand: fraction of notes covered by pattern matches (scale ≥ 4, arpeggio ≥ 3, ≥ 1-bar cell repeat exact or sequential), as an exact rational | exercise | T1 ≥ 0.70 · T2 [0.30, 0.70) · T3 < 0.30 | every note not covered by a pattern match (T ≥ 2) |

**Null rule.** A dimension whose defining input is absent (LH silent for the
whole exercise → `hands.lh_pattern`, every `.lh` key; RH silent → every
`.rh` key) reports `rung: null`. Null passes every ceiling, is excluded
from the overall scalar, and produces no calibrator evidence. "No rests" is
not null — it is R1.

**Owners and `perMeasure`.** An exercise-owned dimension writes its exercise
rung into every `perMeasure` slot (so `measuresAtMax = measureCount` and
the occurrence floor is trivially met); a dimension with a measure-owned
component and an exercise-owned trigger (`pitch.key` changes,
`rhythm.meter` `sigChanges`) writes the trigger's rung from the triggering
measure on; a window-owned feature assigns each window's rung to every
measure it covers.

**Tempo features (exercise-level, not a rung).** The vector stores
`tempo.bpmBeat` (bpm at `beatUnit(timeSig)`, what the band checks),
`tempo.bpmQuarter` (the substrate's normalization) and
`tempo.shortestValueMs`; verify rejects an exercise outside its level's band
or under its floor. Ability is per rung; the calibrator scales credit by
tempo ratio (§Calibration).

**Note tags (for attribution).** For every onset the scorer records which
dimensions it instantiates at rung ≥ 2, per the *Tags* column.
`FeatureVector.noteTags` maps notehead id → `DimKey[]`; every notehead of
a chord gets the chord's tags. Attribution debits only tagged dimensions,
and `perDim.active` counts tagged onsets, so every dimension can earn
evidence.

**The persisted vector:**

```ts
interface FeatureVector {
  taxonomyVersion: string; scorerVersion: string;
  scoreDocId: string; scoreDocHash: string;
  measureCount: number;
  dims: Record<DimKey, {
    rung: number | null; rungKey: string | null;
    perMeasure: (number | null)[];
    measuresAtMax: number;                     // count of perMeasure entries equal to `rung`; the occurrence floor reads it
    features: Record<string, number | boolean | string>;
  }>;
  tempo: { bpmBeat: number; bpmQuarter: number; shortestValueMs: number };
  crossing: boolean; handSpan: { rh: number; lh: number };   // Δ staff steps
  overall: number;
  noteTags: Record<string, DimKey[]>;
}
```

`exercises.feature_vector` stores it verbatim; two vectors are diffable by
`features`. **Overall scalar:** `norm_d = (rung − 1)/(maxRung − 1)` over
non-null dimensions, `overall = Σ w_d · norm_d / Σ w_d`, v1 weights all 1.0,
never used by verify or the calibrator.

**Versioning.** `taxonomyVersion` changes on any edit to the dimension set,
a ladder's rung count or order, a threshold, a weight, a coupling rule or a
preset cell. `scorerVersion` changes on any edit to feature extraction or
note tagging. `generatorVersion` changes on anything that alters a recipe
fixture. Every rung has a stable `rungKey` (`rhythm.syncopation/offbeat-quarters`)
stored next to its index so a reorder is detectable by diff. Every stored
vector, attempt and ability snapshot carries `{ taxonomyVersion,
scorerVersion }`; a reader needing the current versions recomputes from the
stored ScoreDoc (the scorer is pure TS and runs anywhere the doc is) and, if
it persists the result, does so as a client-executed provenance run with
extractor `scorer`, `extractorVersion = scorerVersion`, `params = {
taxonomyVersion, scoreId, scoreDocHash }`. A taxonomy major bump
invalidates ability snapshots (rebuilt from the attempt log); a minor bump
invalidates vectors but not attempt outcomes. Fixtures are tagged with the
`taxonomyVersion` they pin; a bump without touching fixtures fails the suite.

**Fixtures.** For every (dimension, boundary between rung k and k+1) there
are two minimal ScoreDoc fixtures — `__fixtures__/<dimId>/<rungSlug>.at.json`
and `<rungSlug>.below.json`, `rungSlug` being the part of the rung key after
the slash — that differ in exactly one feature value across the threshold,
each with an `expect` block `{ taxonomyVersion, dim: DimKey, rung, features
}` (exercise-level aggregates, as the vector stores them) written by a human
reading the table above — never by running the scorer — with the hand
computation in the PR description. A second corpus of reference exercises
(≥ 1 per level, authored by Nick) carries a full expected vector and pins
cross-dimension interactions. Both corpora are re-ratified on every
`taxonomyVersion` bump.

## Generation: constrain first, verify after

**Spec:**

```ts
interface Spec {
  taxonomyVersion: string;
  key: { tonic: 'C'|'D'|'E'|'F'|'G'|'A'|'B'; alter: -1|0|1; mode: 'major'|'minor' };   // fifthsOf/keySigOf in theory/keys.ts
  meter: { count: number; unit: 2|4|8; grouping?: number[] };   // grouping required for 5/8, 7/8; the substrate's closed set
  lengthBars: 4 | 8 | 12 | 16 | 20 | 24;                        // whole 4-bar phrases
  form?: 'AA\'' | 'AB' | 'AA\'B' | 'AA\'BA\'';                  // required at ≥ 16 bars
  tempo: { bpm: number; unit: Duration };                        // the beat unit of the meter (beatUnit)
  hands: 'both' | 'rh' | 'lh';
  maxHandSpan: 5 | 6 | 7;                                        // Δ staff steps; default 7 (octave); 'small hands' setting
  anacrusis?: { beats: Fraction };
  harmonicRhythm: 'bar' | 'half' | 'beat';
  dims: Record<DimKey, { target: number | null; mode: 'focus' | 'comfort' }>;
}
```

The generator writes `tempo` into `doc.tempo` (the substrate's required
initial state; `Measure.tempo` is for mid-exercise changes, which v1
exercises never emit), sets `systemBreak` on `measures[i]` for every `i > 0`
with `i % 4 === 0` (`i ≡ 1 mod 4` when `measures[0].pickup`) so phrases are
lines, and carries `meta.recipe` — the `Recipe` object verbatim (the
substrate's `ScoreMeta.recipe` is this type; `recipe_hash`, the short code
and `ScoreDoc.id` all hash `canonicalJson(recipe)`). The player derives
metronome pulses per bar from `tempo.unit`, never from a bare number.

Pipeline, per candidate:

1. **Harmonic skeleton** — a progression grammar whose chord pool is gated
   by the `pitch.accidentals` ceiling: A1 I, IV, V, V7 (minor needs A2: i,
   iv, V with the raised 7th, VI); A2 + ii, vi, iii; A3 + V/V, V/vi, vii°7,
   first inversions; A4 + borrowed iv, ♭VI, Neapolitan, applied dominants
   in either hand, second inversions; A5 + chromatic mediants, augmented
   sixths. Harmonic rhythm from the spec. Cadences per §Coherence C1. In
   minor the skeleton uses harmonic minor for V and vii°, melodic minor for
   ascending 6–7–8 in the RH walk, the natural 7th elsewhere; every raised
   degree is a written accidental and is counted by the scorer (as A2).
2. **Rhythm per phrase** — draw a cell vocabulary `V` under the `rhythm.*`
   ceilings (size per C2); draw a bar-rhythm plan for each phrase from a
   level-gated template pool (L1–L3: a a b a, a a a b; L4–L6: + a b a b,
   a a' b a'; L7+: + a b c a, free); realize each bar from its plan letter
   using only cells in `V`; the cadence bar always takes the close cell.
   The `hands.together` target constrains the LH plan's relation to the
   RH plan (H4 same plan; H5 halved cells; H6 LH figuration; H7 a separate
   plan with ≤ 2 cells); `hands.lh_pattern` picks the LH realization class.
   Filling measures independently makes cell reuse a coincidence — the
   simulation of the previous draft produced 6.8 distinct bar-rhythms in
   8 bars; a readable period has 3.
3. **Pitch realization** — RH from a motif (C2) elaborated by *pattern
   tiles* (scale fragment, broken chord, sequence, repeated cell) at T1,
   mixed with a tonal walk (chord-tone / scale-tone / approach-tone
   weights) at T2–T3; interval distribution under `motion.intervals`,
   window and shift contexts under `motion.position`, ledger lines under
   `pitch.ledger`; unisons permitted at every rung, at most 3 consecutive
   repeated pitches; a 1-bar cell recurs at most twice per phrase and whole
   phrases never repeat verbatim. LH from its pattern class over the
   skeleton, inversions chosen so every LH note stays in the LH window at
   Q1. For `hands: 'lh'` the LH is realized by the RH melodic rules in the
   bass-clef range. Voice-leading sanity (resolve leading tones, no voice
   crossing, no strong-beat m2/M7 clash between hands, no melodic augmented
   2nd or tritone below L7) as hard constraints.
4. **Expression decoration** (emitted, unscored): tempo word (`Tempo.text`)
   + metronome mark always; starting dynamic in both hands from L2; phrase
   slurs from L3; one dynamic change per 8 bars and staccato on
   repeated-note cells from L4; staccato/legato contrast from L5; starting
   finger numbers for both hands through L5 and a fingering hint at every
   shift through L6.
5. **Legality pass** — spelling through the substrate's `pitch.ts`
   (`spellMidi`, never double accidentals below A5); tie-vs-value notation
   under the imaginary-barline rule (a value may not obscure the mid-bar in
   4/4 except a half on beat 2; values may not cross a beat in compound
   meter unless tied); cautionary accidentals set via `courtesy: true` on
   the first recurrence of an altered letter in the next bar and on the
   same letter in another octave within the bar — display-only, invisible
   to the scorer. Beaming is the serializer's job, not the generator's.
6. **Verify** — `validateScoreDoc` (any issue is a re-roll), then the
   scorer: accept iff (a) no owning unit exceeds any ceiling; (b) every
   focus dimension meets the **occurrence floor** — at its target rung in
   ≥ 1 measure of every 4-bar phrase and `measuresAtMax / measureCount ≥
   0.25` — so an exercise cannot "target" a skill it barely contains;
   (c) tempo within the band and the shortest value over the floor; (d) the
   coherence check passes. Non-focus dimensions have no floor.
7. **Candidate pool and deterministic ranking** — up to K = 8 candidates
   that pass steps 5–6 (sub-seeds from the recipe seed), each scored by a
   versioned coherence score (weighted sum of the coherence vector, weights
   in `generatorVersion`); emit the argmax. Any future re-ranker lives
   inside `generatorVersion`; a non-deterministic one is prohibited unless
   its chosen index is stored in the recipe.

Generate-within-constraints *plus* verify-after is the belt and braces: the
grammars aim at the budgets, the scorer proves them. The two sides share the
taxonomy but not code paths, so a generator bug can't silently redefine
difficulty.

### Coherence requirements

Sight-reading is pattern recognition; the previous draft's "occasional motif
repetition" produced note-salad under simulation. These are hard constraints
the legality pass builds toward and verify checks (`app/src/generation/
coherence.ts`, separate from the scorer):

- **C1 Form.** Whole 4-bar phrases in antecedent–consequent pairs: the
  antecedent ends on a half cadence (V; melody on 2̂, 5̂ or 7̂), the
  consequent on a perfect cadence (V(7)–I; melody on 1̂, or 3̂ from L6),
  with the root in the bass when H ≥ H3; the final note or chord lasts
  ≥ 2 beats on a downbeat, and both hands end together when H ≥ H3 (at
  H1–H2 the sounding hand closes alone). At 4 bars the single phrase closes
  on a perfect cadence. At 12 bars the form is a period plus a 4-bar
  consequent restatement (a a' a'', the last re-closing on I). At ≥ 16 bars
  `form` chooses AA' (second period restates the first with a new
  consequent) or AB (contrasting B returning to the opening motif in its
  last 2 bars); at 20/24 bars AA'B / AA'BA', each letter an 8-bar period
  and a 4-bar remainder a consequent restatement.
- **C2 Motif.** Commit to a 1–2-bar rhythmic cell; ≥ 50 % of bars are the
  cell or a one-note variant; the consequent's first two bars restate the
  antecedent's (a a'); sequences allowed from L3 with at least one diatonic
  sequence per exercise at L ≥ 3 and `motion.intervals` ≥ I2. Distinct
  one-beat rhythm cells per hand per exercise ≤ 2 (L1–L2), ≤ 3 (L3–L5), ≤ 4
  (L6–L8), ≤ 6 (L9–L10); distinct whole-bar rhythms ≤ 3 in 8 bars / ≤ 5 in
  16 at L ≤ 6; at H7 the LH still draws from ≤ 2 cells.
- **C3 Contour.** Two or three contour templates, governing the
  transposition levels of motif statements, not individual notes; a leap ≥
  a 4th is followed by a step in the opposite direction (≤ L6); no two
  successive leaps in one direction beyond a 5th; one climax per 8 bars;
  never leap into a chromatic note (≤ L6).
- **C4 Hand position.** RH notes in any 4-bar window fit under one position
  at Q1 and a stretch at Q2; shifts only in `shiftContext` (≤ Q3), never
  inside a beamed group; the note after a shift is a step or repeat; at Q1
  the first note of each hand carries a fingering and the player header
  shows the position ("RH thumb on C4 · LH 5 on C3").
- **C5 Harmony.** Strong-beat RH notes are chord tones (beat 1 in 3/4, 6/8,
  2/4; beats 1 and 3 in 4/4); non-chord tones on weak beats, approached
  and left by step (≤ L6); harmonic rhythm per the spec.
- **C6 Rhythm.** Beat 1 of every bar has an onset in at least one hand
  (≤ L6); an anacrusis (from L3) shortens the final bar to complement it
  (`measures[0].pickup` plus `Measure.complement` on the final bar).
- **C7 Marks.** The step-4 decoration is present per level; verify checks
  presence, not taste.

The coherence vector `{ motifReuse, cellVocabulary, barRhythmVocabulary,
sequenceCount, cadence: { mid, final }, climaxCount }` is persisted next to
the feature vector and pinned by the recipe fixtures.

### Determinism, recipes and re-rolls

Seeded PRNG (mulberry32-class), no `Math.random`, no clock, no ULIDs
(element ids come from the substrate's `seededIdSource(rng)`, so two
generations of one recipe are byte-identical JSON). An exercise's
**recipe** is

```ts
interface Recipe { generatorVersion: string; scorerVersion: string; taxonomyVersion: string; spec: Spec; seed: number /* uint32 */ }
```

`scorerVersion` is in the recipe because the verify loop's accept/re-roll
decisions are part of the output — a stricter scorer accepts a different
candidate for the same seed. Each candidate uses its own stream, `rng =
mulberry32(hash32(seed, stage, index))` (FNV-1a over the three uint32s), so
a scorer change can only change *which* candidate is accepted, never the
notes of a given candidate. Budget: 32 candidates per stage, 3 stages; a
stage raises exactly one non-focus ceiling by one notch — the first
dimension in the fixed order rests → syncopation → accidentals → intervals
→ position → density → values whose measured breach caused the most
rejections in the previous stage — and appends to `relaxationTrace`;
`meter`, `key`, `hands` and focus dimensions are never relaxed. After stage
3 the result is `{ ok: false, kind: 'exhausted' | 'unsatisfiable', trace,
nearest? }`, which the player renders, naming the combination and offering
the nearest satisfiable spec.

A generated exercise persists `{ recipe, effectiveSpec, relaxationTrace,
candidate: { stage, index }, scoreDoc (as a scores row), featureVector,
coherenceVector }` through `POST /v1/exercises` in one transaction
(§Persistence), and the ScoreDoc carries `meta.recipe` and `meta.title` =
the exercise short code `SR-L<level>-<first 6 hex of sha256(canonical
recipe)>` so a printed, exported or forked exercise keeps its identity.
Reproducibility contract: while all three versions are current,
`generate(recipe)` reproduces `scoreDoc` byte-for-byte and the fixture
suite asserts it; the app keeps no older generator code, so the persisted
ScoreDoc is authoritative and the recipe is lineage. A recipe is the
exercise, so the player's URL carries it —
`#/sight-reading?r=<base64url(canonicalJson(recipe))>` — and a pasted link
reproduces it byte-for-byte on either build with no server.

**Rejected alternatives**:

- **LLM generation** — can't be trusted to hold hard constraints (ceilings
  are the product), non-deterministic, adds latency/cost to something a
  procedural generator does in microseconds. Never the constraint holder;
  a future re-ranker sits inside `generatorVersion` under the determinism
  rule above.
- **Corpus/Markov models** — need a curated, leveled corpus, which is the
  book problem again. Later option once our own attempt corpus exists.
- **Full CSP solver** — heavier machinery than 24 bars needs; weighted
  grammars + rejection + the normalizer hit the budgets with simpler, more
  tunable code.

## Where it runs: client-side TS, deliberately

The generator, scorer, coherence check and calibrator are pure TS modules
in `app/src/generation/`; the matcher is `app/src/midi/matcher.ts`, beside
SB7's recorder. Because:

- The theory stack is single-source in TS. The key and spelling helpers in
  `chord-identity.ts` (`keySignatureMap`, `MAJOR_KEY_ACCIDENTALS`,
  `RELATIVE_MAJOR`, `normalizeAlter`) are module-private today; SR1's first
  task extracts them into `app/src/theory/keys.ts` (plus `diatonicPitches`,
  `fifthsOf({ tonic, alter, mode })`, `keySigOf(fifths, mode)` and the
  substrate's `spellMidi`) and `chord-identity.ts` re-imports them. No new
  `@tonaljs` package is added unless it becomes a direct dependency (only
  `@tonaljs/scale-type` is one today).
- ScoreDoc is TS-native; generation emits it directly.
- Pure + deterministic = trivially testable in vitest (recipe fixtures pin
  exact output).
- **It works on the public showcase build.** On `backendEnabled = false`
  the player runs generation, scoring, coherence, the metronome, Web MIDI
  capture and the matcher, and paints verdicts through the in-memory
  annotation store. Kept in memory for the tab lifetime: the chosen level
  or manual spec, the ability vector (initialized from the level), the
  session's attempts, and the seen-recipe set; nothing in `localStorage`
  (the showcase rule); the recipe URL is the only thing that survives a
  reload. Gated on `backendEnabled`: saving exercises, attempts and
  recordings; calibration memory across sessions; the raw MIDI log.
  `generation/`, `coherence.ts`, `midi/matcher.ts` and `calibrator.ts`
  import nothing from `api/` (`config.test.ts`).

The backend stores scores, exercises, attempts, recordings, runs and
ability snapshots when enabled — plain CRUD on the standard mixins, no music
logic; it never computes a rung, a verdict or an ability.

### Exercises as subjects

`SubjectKind` gains `'exercise'`; the subject id is `exercise:<uuid>`
(SB4's convention). `subjectFromExercise(ex)` builds a `Subject` with title
= the short code, byline = the focus dimension labels, meter and
`bpmTarget` from the spec, `abc: undefined` and `score: ScoreDoc` (a new
render source `SessionView` feeds through `renderScoreDoc`; the player adds
that branch to `Score.tsx` only and leaves `SessionScore.tsx` to SC2). A
practice session can sit in front of an exercise, a recording is *of* an
exercise, and a collection can hold one — the one-timeline story. The
exercise's ScoreDoc is a `scores` row (`meta.source: 'generated'`,
immutable; editing forks) referenced by `exercises.score_id`, so verdict
layers target `{ kind: 'score', id }` like every other annotation.

## Assessment: MIDI-first, honest fallback

MIDI hardware exists (USB/BT), so assessment is objective from day one, and
it works on the public build too — only persistence is gated.

**Attempt lifecycle.** `preview → countIn → playing → finished | stopped |
abandoned`. *Preview* shows the full score with the metronome silent and
MIDI ignored for `previewSeconds` (default 30, user-settable 15–60,
skippable with Start; `previewPlayingAllowed` defaults to false). The
**metronome is mandatory** — it clicks from the count-in through the last
bar, cannot be muted during `playing` (volume and visual-only are allowed),
and it enforces the one rule of sight-reading: keep going. Before the
attempt the player sees only level, the focus dimensions as chips, key,
meter, tempo mark and the short code; after it, the full verified vector,
the coherence badge, any relaxation applied, the outcome and the verdict
layer. The note cursor is off during `playing` by default (`guide: 'none' |
'bar' | 'beat'`; `'bar'` suggested at L1–L2; the `bar`/`beat` guides ride
SC2's CursorLayer with `rate = attempt bpm ÷ encoded bpm`). Count-in:
length per the preset; the beat unit is `tempo.unit` (dotted quarter in
6/8); a visual "1 2 3 4" driven by the audio-clock queue; one `aria-live`
announcement; `prefers-reduced-motion` disables the pulse; Space starts,
Esc stops; the `AudioContext` is created in the Start handler.

**Capture and clocks.** `useMetronome` grows a contract (SR5 owns it):
`useMetronome({ bpm, beatsPerBar, grouping?, countInBars, totalBars,
running, onGridStart, onBar, onDone })`, where `onGridStart({ contextTime,
performanceTime, outputLatencyMs })` fires once with the scheduled
audio-clock time of bar 1 beat 1 and its mapping to the performance clock
(`AudioContext.getOutputTimestamp()`, `outputLatency ?? baseLatency`). The
heard downbeat on the MIDI clock is `gridT0Ms = performanceTime +
(contextTime − outputTs.contextTime) × 1000 + outputLatencyMs +
latencyTrimMs`; Web MIDI `timeStamp`s are on the performance clock and all
matcher timing is `t − gridT0Ms`. `latencyTrimMs` is a user setting
(−100..+300, default 0) with a one-tap calibration ("play with the click for
8 beats"). Tempo is **locked** from count-in to end and recorded as
`attempts.tempo_bpm` in beat units (`capture.clickUnit`); the SMF tempo
meta and `msAt()` use `quarterBpm = tempo_bpm × quarterLength(clickUnit)`,
the substrate's normalization. Capture reuses SB7's `MidiRecorder` with
`{ origin: 'external', t0Ms, silenceTimeoutMs: null }` (amends SB7): arm
before the count-in, stop one pulse after the final barline; a bar of rests
at 40 bpm must not end the take.

**A MIDI attempt is a recording.** Every `midi`-mode attempt creates an RC1
`recordings` row (subject `exercise:<id>`, `session_id` when inside a
practice session) with one `recording_tracks` row of kind `midi`;
`attempts.recording_id` references it. The track is a type-0 SMF from SB7's
encoder (SR6 encodes it so `inputSha256s` exists on the public build; SR7
uploads it) with tempo meta = `quarterBpm`, PPQ 480, tick 0 = the heard
time of the first count-in click and a marker meta at bar 1 beat 1; every
channel message from arming to stop is kept (note-on/off, CC64,
velocities) — the v1 matcher ignores pedal and velocity, but they are
ground truth for later extractors. The clock anchor `{ gridT0PerfMs,
clockOffsetMs, outputLatencyMs, latencyTrimMs, countInBars, clickUnit,
inputDevice, userAgent }` is stored as `attempts.capture` and as a text
meta in the SMF, so every verdict is recomputable with the same time base;
the track's `offset_ms` is the first count-in click relative to
`recordings.captured_at` (the arming time). Self-report attempts create no
recording.

**Expected onset grid** = `soundingEvents(doc)` from the substrate: tie
continuations produce no onset (their ids get no verdict; the chain anchors
to the tie-start), rests produce no onset (played notes in a rest window are
extras), a chord is one onset with N pitches (a chord tied in on some notes
contributes just its new pitches), all notes across both staves and voices
at equal `onset` form one **onset group** (id = hash of member note ids),
and a unison between hands is one expected key. `expectedMs = gridT0Ms +
msAt(onset, quarterBpm)`.

**Matching** is an offline, monotone global alignment over the complete
MIDI log (Needleman–Wunsch-class DP), not a real-time greedy follower — a
greedy pass may paint provisional verdicts while playing, but the stored
property always comes from the offline aligner. Played notes within
`chordSpreadMs = 40` form a played chord. Costs: `pitchCost` = fraction of
expected pitches absent; `timeCost` 0 inside the on-time band rising to 1 at
the window edge; `missed` 1.0; `extra` 0.6. **Windows scale with the local
inter-onset interval**: `halfWindowMs = clamp(0.4 × min(ioiPrev, ioiNext),
40, 200)`, `onTimeMs = clamp(0.15 × min(ioi), 30, 80)`. **Resync model**: the
alignment carries a piecewise-constant offset; a transition may change it by
±k beats (k ≤ 4) or by a continuous shift (a stall) at penalty 2.0 + 0.5k,
committed when it wins over the next 8 onsets; each committed change emits
`Resync { fromOnsetId, toOnsetId, offsetBeats, shiftMs, matchRatio }`. The
grid is absolute (the click); a late entry is a resync, never a re-anchor.
Monotone alignment means repeated pitches cannot swap partners. Complexity
≤ ~1 M cells for 16 bars — no worker needed. **Pitch identity** is the MIDI
number, octave-sensitive (`midiOf`); enharmonic spelling is invisible.
**Hands**: played notes are assigned by pitch and time only, never by
staff — a correct pitch in the wrong hand is `correct` (stated limitation);
the *expected* event's hand decides which per-hand dimensions are
candidates for attribution.

**Verdict schema** (property kind `attempt_verdicts`, one per run):

```ts
interface AttemptVerdicts {
  schemaVersion: 1; matcherVersion: string; scorerVersion: string; taxonomyVersion: string;
  tempoBpm: number; clickUnit: Duration; quarterBpm: number; gridT0Ms: number;
  events: EventVerdict[];        // one per expected notehead with an onset
  onsets: OnsetVerdict[];        // one per onset group
  extras: ExtraNote[]; hesitations: Hesitation[]; resyncs: Resync[];
  attribution: AttributionEntry[];
  summary: Summary;
}
type PitchVerdict = 'correct' | 'corrected' | 'wrong-pitch' | 'wrong-octave' | 'missed';
interface EventVerdict { noteId: string; onsetId: string; verdict: PitchVerdict; timing: 'on-time'|'early'|'late'|'n/a';
  deltaMs?: number; playedPitch?: number; playedVelocity?: number; cascade: boolean; inResync?: string }
interface OnsetVerdict { onsetId: string; onset: Fraction; expectedMs: number; noteIds: string[];
  verdict: 'complete' | 'partial' | 'wrong' | 'missed'; spreadMs?: number; rolled: boolean }
interface ExtraNote { id: string; tMs: number; onset: Fraction; measureId: string; pitch: number; velocity: number; nearestOnsetId: string; cascade: boolean }
interface Hesitation { id: string; kind: 'stumble' | 'stall' | 'skip'; atOnsetId: string; shiftMs: number; beatsSkipped?: number; recoveredAtOnsetId?: string }
interface Resync { id: string; fromOnsetId: string; toOnsetId: string; offsetBeats: number; shiftMs: number; matchRatio: number }
interface AttributionEntry { dimension: DimKey; phrase: number; localRung: number; kind: 'debit' | 'credit'; weight: number; sourceIds: string[] }
interface Summary { expectedNotes: number; correct: number; corrected: number; wrongPitch: number; wrongOctave: number; missed: number; extras: number;
  stumbles: number; stalls: number; skips: number; completed: boolean; lastReachedOnsetId: string; tempoRatio: number; cleanPhrases: number[];
  perDim: Record<DimKey, { active: number; debited: number }>; grade: 'clean' | 'wrong-notes' | 'hesitated' | 'fell-apart' | 'stopped' }
```

Decision procedure per expected note: matched with equal MIDI number →
`correct`; matched to a different number → `wrong-octave` if the pitch class
is equal and |Δ| ∈ {12, 24}, else `wrong-pitch`; unmatched with an unmatched
played note inside the window → `wrong-pitch` with that `playedPitch`;
unmatched otherwise → `missed`; an extra inside the window followed by the
correct note for the same event → `corrected` (the extra is consumed).
Chords: each member notehead gets its own `EventVerdict`; the onset is
`complete | partial | wrong | missed`; `rolled = spreadMs > 60` is reported,
not penalised. `extras` are anchored by `scoreTime` at the played onset
quantized to the nearest 1/48 quarter, `staffIndex` = the nearest expected
onset's hand.

**Hesitations** are computed from aligned pairs with `delta_k = t_k −
expectedMs(o_k)` and local drift `median(delta_{k−3..k−1})`: a **stumble**
is `|delta − drift| > max(0.25 beat, 120 ms)` with the next onset back in
band (timing evidence only); a **stall** is `delta − drift > max(0.5 beat,
250 ms)` persisting over ≥ 2 further onsets, ending at the first onset back
in band or at a resync with `shiftMs > 0` (the player rejoined the click);
a **skip** is a resync with `offsetBeats < 0`. Stalls and skips are errors
for attribution (window = the material *after* `atOnsetId`, since a stall
is the eye–hand span emptying). With a click running there is no "tempo
dip" to estimate; this is what "the real currency of sight-reading" means
operationally. A **restart** (re-alignment to an earlier bar, up to one bar
back) is recorded as a hesitation at that bar and sets `stoppedAtMeasure`.
All thresholds are `params` (hashed) so retuning is a new run.

**Grade rule** (display and the self-report scale, not the calibrator's
input): `noteAccuracy = correct / expected`; `completed = false` when no
expected note is matched for 2 consecutive bars. `clean` iff completed ∧
accuracy ≥ 0.95 ∧ hesitations ≤ 1 per 8 bars; `stopped` iff a restart or a
Stop; `fell-apart` iff ¬completed ∨ accuracy < 0.80 ∨ hesitations ≥ 1 per 2
bars; `hesitated` iff any stall/skip otherwise; else `wrong-notes`.

**Attribution** (part of the matcher's versioned surface, reading the
scorer's `noteTags`):

1. **Window.** Sight-reading errors are caused by what the eye is decoding
   *next* (eye–hand span ≈ 1–2 beats) and by recovery from the previous
   error, not by "that moment". An error at score time `t` has window `W =
   [t − 1 beat, t + 2 beats]` (params).
2. **Candidates and weights.** For each dimension `d`, `excess_d =
   max_{o∈W}(localRung[d][o]) − comfort[d]` (comfort from the attempt's
   `spec_snapshot`); candidates have `excess ≥ 0`; `weight_d = (1 +
   excess_d) / Σ(1 + excess)`; at most two dimensions per error. Error-kind
   priors multiply first: a wrong pitch equal to the key-signature spelling
   of an expected chromatic note → `pitch.accidentals` ×2; a wrong pitch
   equal to the natural of a key-signature note → `pitch.key` ×2;
   `wrong-octave` → `pitch.ledger`/`pitch.clef` ×2; ≥ 3 consecutive wrong
   pitches in one hand offset by a constant interval → one
   `motion.position` debit, not per note; a partial chord →
   `texture.density` ×2; LH wrong while RH correct → `hands.lh_pattern`
   (or `hands.together` at H ≤ H4) ×2; an isolated late/early onset with
   the grid intact → `rhythm.*` per the tags; stalls/skips → `rhythm.*` and
   `hands.together` ×2.
3. **Unattributed.** If no candidate exists (everything in `W` is below
   comfort) the error is a slip: recorded with `attribution: []`, debits
   nothing.
4. **Cascade rule.** Errors sorted by score time; an error is a *root*
   unless a root exists within `max(1 beat, 500 ms)` before it; every
   error inside a resync span except its first is cascade. Cascade errors
   count in the summary and paint dimmed, but produce no
   `AttributionEntry` — recovery errors are consequences, not evidence.
5. **Credit is per phrase.** A phrase is *clean* iff it contains no root or
   cascade error, no stall or skip, and the attempt reached past it;
   stumbles and early/late timing do not break cleanliness. Each clean
   phrase credits every dimension at `max localRung` over its onsets. The
   `summary.perDim` counts (`active` = onsets where the dimension was
   tagged, `debited`) are what the calibrator reads.
6. **Output**: `AttributionEntry` rows inside the property; the calibrator
   consumes only these and `perDim`, never raw verdicts.

**Display**: verdicts render as a **virtual system layer** on the
exercise's score — one `EphemeralAnnotation` per expected notehead
(`correct` included: the layer is the full result), `verdict` bodies
carrying the pitch verdict, `timing`, `cascade` and `inResync`, extras at
`scoreTime`, hesitations as `hesitation` bodies over `scoreTime` spans —
projected at render time from the chosen run's `attempt_verdicts` by the
substrate's projection mechanism. Layer key `assessment`, one entry per
attempt in the run picker, default = the newest succeeded run of the
attempt being viewed. Nothing is written to `annotations`; the same code
path renders the layer on the public build from an in-memory run object.

**Self-report** (no hardware, or in addition to MIDI — always collected,
one tap after the run): `clean | wrong-notes | hesitated | fell-apart |
stopped`, plus an optional "what was hard" multi-select limited to the
dimensions present in the exercise's vector at rung ≥ 2, and tap-to-mark on
bars during review (a user annotation with a `measures` anchor and a
`highlight` body in the `user:default` layer). The pair (self-report,
machine grade) on MIDI attempts is the corpus for tuning hesitation
thresholds against felt difficulty.

**Provenance.** The matcher is an extractor under the recordings contract,
**executed in the browser**: `POST /v1/runs` accepts a *completed* run —
`{ subjectKind: 'recording', subjectId, extractor: 'midi-matcher',
extractorVersion: MATCHER_VERSION, executor: 'client', params, inputSha256s,
status: 'succeeded', properties: [...] }` — inserted with its properties in
one transaction under the same unique key (a resubmitted identical attempt
is a 200 hit). `params = { exerciseId, scoreId, scoreDocHash, scorerVersion,
taxonomyVersion, tempoBpm, clickUnit, gridT0Ms, latencyTrimMs, windows,
thresholds }` — the ScoreDoc is referenced by hash, never embedded;
`inputSha256s = [midiTrack.sha256, scoreDocHash]` is a top-level field the
server folds into `params` for the key. The run's subject is the attempt's
recording, so two attempts of one exercise never share a key, and the same
run carries the `alignment_map` property — payload `{ scoreId, scoreDocHash,
points: [{ q, ms }] }` per the recordings doc, `ms` on the recording clock:
`ms = midiTrack.offset_ms + (tPerf − gridT0Ms)` — that the recordings bridge
consumes. **Recompute policy**: the worker never runs client extractors;
opening an attempt whose newest succeeded `midi-matcher` run has
`extractor_version < MATCHER_VERSION` re-runs against the stored track and
posts a new run; an attempt-list action does it in bulk. Verdicts are
recomputable, not recomputed for free — the recordings doc says the same.

## Calibration: legible v1, log for the future

**Observations are sacred, beliefs are disposable.** An *observation* is one
attempt × one verdict source, immutable, credence-clean (no θ, no
probabilities, no calibrator output), export-ready for the crucible
evidence log when that integration un-defers:

```ts
export const SOUNDINGS_NS = '5f5f5f5f-736f-756e-8000-64696e67732d';   // the one fixed namespace (app/src/lib/ids.ts, mirrored in backend/app/ids.py)
export interface Observation {
  id: string;                    // uuid5(SOUNDINGS_NS, `soundings:attempt:${attemptId}:${verdictRunId ?? 'self'}`)
  supersedes?: string;           // the previous observation for the same attempt when a newer matcher run lands
  attemptId: string; exerciseId: string; recipeHash: string; learner: string;
  occurredAt: string; latencyMs: number;                       // tz-aware start of the attempt; wall-clock duration
  mode: 'midi' | 'self'; reliabilityTier: 'objective' | 'passive'; grader: 'objective' | 'self';
  exposure: number; specSource: 'adaptive' | 'manual';         // exposure: 1 = first sight (the sighting count, not the vector's measuresAtMax)
  tempoBpm: number; clickUnit: Duration; tempoRatio: number; meter: string; bars: number;
  scored: Record<DimKey, number | null>;                        // the scorer's rung vector for the exercise as played
  versions: { taxonomy: string; scorer: string; generator: string; matcher?: string; verdictRunId?: string };
  outcome: { grade: Summary['grade']; completed: boolean; stoppedAtMeasure?: number; noteAccuracy?: number; hesitations?: number;
             perDim?: Record<DimKey, { active: number; debited: number }>; cleanPhrases?: number[] };
  selfReport?: Summary['grade']; selfReportDims?: DimKey[];
}
```

The `attempts` row stores this record; the observation is a pure projection
of `attempts ⨝ newest succeeded midi-matcher run`. A re-match produces a
new observation whose `supersedes` points at the old id; the calibrator
replays over the newest per attempt. `outcome` carries counts and labels
only — matcher confidences, window parameters and anything the calibrator
computes are excluded by construction (a unit test asserts no numeric field
in [0, 1] other than `noteAccuracy`).

**Ability is continuous; rungs are its display.** Per dimension `θ_d` on
that ladder's rung scale, plus an effective evidence count `nEff_d` and a
last-evidence timestamp. There are no promotion/demotion counters — a
consecutive-count ladder churns at the boundary (simulated: ~22 rung flips
per 60 attempts) and biases a full rung low, because promotion would require
cleaning material a rung above the state. The calibrator is a pure,
versioned function with config-as-data params (hashed like an extractor
run):

```ts
export const PARAMS = { k: 2.5, gain: 0.35, gainLowConf: 0.6, lowConfN: 3, selfWeight: 0.5, selfNCap: 4,
                        halfLifeDays: 30, hyst: 0.05, pComfort: 0.85, pEdge: 0.55 };
const pClean = (theta, r) => 1 / (1 + Math.exp(-PARAMS.k * (theta - r)));
export function displayRung(a, prev, R) {            // hysteresis: the badge never flickers
  if (prev < R && pClean(a.theta, prev + 1) >= PARAMS.pComfort + PARAMS.hyst) return prev + 1;
  if (prev > 1 && pClean(a.theta, prev) < PARAMS.pComfort - PARAMS.hyst) return prev - 1;
  return prev;
}
export const comfortRung = (a, R) => max rung r with pClean(a.theta, r) ≥ pComfort (floor 1);
export const edgeRung    = (a, R) => max rung r with pClean(a.theta, r) ≥ pEdge, ≥ comfortRung;
export function update(ab, o: Observation) {
  if (o.exposure > 1) return ab;                      // a re-sight is not sight-reading evidence
  const w = (o.mode === 'midi' ? 1 : PARAMS.selfWeight) * Math.min(1, o.tempoRatio);
  for (const d of dims where o.scored[d] !== null) {
    const r = o.scored[d]; const a = decay(ab[d], o.occurredAt); const pe = pClean(a.theta, r);
    const s = successFor(d, o);                       // graded, see below
    const g = a.nEff < PARAMS.lowConfN ? PARAMS.gainLowConf : PARAMS.gain;
    const credit = s > pe && o.tempoRatio < 0.8 ? 0 : s - pe;   // slow attempts consolidate, never promote
    ab[d] = { theta: clamp(a.theta + w * g * credit, 1, R[d]), nEff: bumpN(a, o), lastEvidenceAt: o.occurredAt };
  }
}
```

`successFor(d, o)` for a MIDI attempt is `1 − debited_d / active_d` (clipped
to [0, 1]) from `outcome.perDim` — every exercised dimension receives
evidence from every attempt, at the rung the scorer *measured*, and credit
and blame both flow through attribution; the focus list is a generation
concept and plays no role in the update. For a self-report attempt,
`successFor` is `clean` 1, `wrong-notes` 0.5 for pitch/motion dimensions
and 1 elsewhere, `hesitated` 0.5 for rhythm/hands dimensions and 1
elsewhere, `fell-apart`/`stopped` 0, restricted to the dimensions the
player selected when they selected any. The expected-score term is what
makes probing free: a failure at the edge rung is expected (P ≈ 0.55) and
barely moves θ; a failure at the comfort rung is surprising and moves it a
lot. Debits are never tempo-scaled (an error at a slower tempo is stronger
evidence). Fixtures pin: θ converges within 0.5 rung of a simulated logistic
learner in ≤ 40 attempts; a learner at θ = 2.5 changes displayed rung fewer
than 4 times in 60 attempts; an easy rep (`pe ≥ 0.95`) moves θ by < 0.02.

**`nEff`, not "confidence".** `nEff_d` is the decayed count of observations
that exercised `d`: × `2^(−Δdays/30)` on each update, +1 per objective
observation, +0.5 per self-report (capped at 4 from self-report alone, so a
dimension with only self-graded evidence is always low-confidence and due
for an objective probe when MIDI is available). Low confidence (`nEff <
3`) uses the higher gain and earns the dimension a **probe** — one focus
slot at its edge — before any other focus selection. `nEff` lives only in
snapshots; it is never on an observation and never exported (the crucible's
`confidence_tier` means elicited learner confidence, a different thing).

**Self-report is tiered.** `reliabilityTier: 'passive', grader: 'self'`,
weight 0.5, capped `nEff`; the ability badge says "self-graded" when that is
all the evidence there is. The crucible contract forbids pooling the two
tiers without carrying them, and so do we.

**Placement.** On first use the player picks a level (default L3). The
prior is `θ_d = presetCeiling(L, d) − 0.5, nEff = 0`; the first six adaptive
attempts run at L−1, L, L+1, L+1, then two at whatever the fold says, with
the low-confidence gain in force. Placement can be re-run from settings; it
writes a new prior and the fold replays from it (the prior is recorded on
every snapshot).

**Session policy** (config-as-data): a session is a run of exercises the
player ends at will — default 6 (3–10): a warm-up at level −1 with no
focus, three at level with one or two focus dimensions from *different*
groups (never key + accidentals, never values + syncopation), a stretch at
level +1 on one focus dimension, an easy close at level −1. The next
exercise's kind is drawn from `{ consolidate 0.6, focus 0.3, easy 0.1 }`
when the player keeps going past six. Focus candidates: any pending probe
first, then the weakest link (lowest comfort rung relative to the player's
median), excluding a dimension that has been in focus for 3 consecutive
focus exercises without θ rising, and any dimension at its top rung. Focus
dimensions get `target = edgeRung`; every other dimension `comfortRung`;
`easy` puts everything at `max(1, comfort − 1)`. Variety: no key repeated
consecutively; ≥ 2 meters per session at L ≥ 3; at L ≤ 4 at least one
`hands: 'lh'` exercise (the stated exception to the preset's default of
both hands); sharp- and flat-side keys alternate at the same rung. The
session ends with a summary and, when `backendEnabled`, a "log as practice
session" action (`practice_sessions` row, tag "Sight-read", subject = the
last exercise).

**Never the same recipe twice.** The adaptive seed is drawn fresh per
exercise (`crypto.getRandomValues`, never the clock, never derived from the
spec), the recipe is hashed, and the policy re-draws if the hash exists for
this user (`exercises.recipe_hash` unique per user; an in-memory set on the
public build). "Try again" generates a new seed with the same effective
spec and never re-shows the previous score. A player *may* replay by choice
("Practice this one"); that attempt is stored with `exposure = n` and is
excluded from the fold and from every sight-reading statistic; the UI
labels it "practice (not sight-reading)".

**Override attempts** (`specSource: 'manual'`) are folded by the same
update rule — the expected-score term makes them safe: failing material far
above θ has `pe ≈ 0`, so `s − pe ≈ 0`; cleaning it moves θ a lot, as it
should. A manual pick never sets θ; only placement sets a prior.

**Replay is the definition of ability.** `calibrate(observations, params,
prior) = observations.sortBy(occurredAt).reduce(update, prior)`, where an
observation whose `versions.taxonomy` is not current has its `scored`
vector recomputed by the current scorer over the exercise's stored ScoreDoc
(that is why the ScoreDoc is persisted), the verdict used is the newest
succeeded run for that attempt, and voided and `exposure > 1` attempts are
skipped. Snapshots are a cache of this fold, never an input to it; a vitest
fixture replays a recorded log and asserts equality with the stored
snapshot. The fold runs on the client: `GET /v1/ability` returns the newest
snapshot with its versions; when they differ from the running code the
client replays the observation log (`GET /v1/attempts` joined with
`latest_properties`) and `POST /v1/ability` stores the new snapshot — the
backend never computes an ability.

**The calibrator never blocks the player.** Manual spec override is always
available; adaptation is a default, not a cage. **A smarter model later
re-reads the same log** — one of the family that takes item difficulty from
the scorer as known (fixed-difficulty Rasch, Elo with tempo and dimension
terms, BKT over the per-dimension `active`/`debited` counts).
Item-calibrated IRT is *not* reachable from this corpus: each exercise is
seen once by one learner, so item parameters are unidentifiable. That is
why the scorer's difficulty must be right, and why the attribution counts
are on every observation.

## Persistence

| Table | Contents |
|---|---|
| `exercises` | `id` = `scores.id` = `uuid5(recipe)`; `score_id` FK → `scores` (the ScoreDoc lives there, `meta.source = 'generated'`, immutable), `recipe` JSONB, `recipe_hash` (unique per user), `effective_spec` JSONB, `relaxation_trace` JSONB, `candidate` `{stage, index}`, `feature_vector` JSONB, `coherence_vector` JSONB, `generator_version`, `scorer_version`, `taxonomy_version`; mixins. Written by `POST /v1/exercises { id, score: { id, doc }, recipe, effectiveSpec, relaxationTrace, candidate, featureVector, coherenceVector }`, which inserts the `scores` row and the `exercises` row in one transaction; an existing id is a 200 hit |
| `attempts` | `exercise_id` FK, `recording_id?` FK (set iff `mode = 'midi'`), `session_id?` FK, `mode 'midi'|'self'`, `spec_source 'adaptive'|'manual'`, `exposure` int (1 = first sight), `tempo_bpm` (beat units) + `click_unit`, `spec_snapshot` JSONB (focus + comfort vector at attempt time), `capture` JSONB (clock anchor, latency, device), `self_report?`, `self_report_dims?`, `outcome` `grade`, `completed`, `stopped_at_measure?`, `preview_ms`, `guide`, `started_at`, `finished_at?`, `voided_at?`/`void_reason?`, versions; `PKMixin`, `TimestampMixin`, `OwnedMixin` — **no `SoftDeleteMixin`**: observations are append-only; `POST /v1/attempts/{id}/void {reason}` keeps the row, skips it in the fold, exports it flagged |
| `ability_snapshots` | `ability` JSONB (per dimension `{ theta, nEff, lastEvidenceAt, displayRung }`), `calibrator_version`, `params_hash`, `taxonomy_version`, `scorer_version`, `as_of_attempt_id`, `observation_count`, `prior` JSONB; one row per calibrator update (rows are cheap), written by `POST /v1/ability` from the client fold |

Verdicts are never stored on the attempt: they are `extracted_properties`
of kind `attempt_verdicts` under the matcher's run on the attempt's
recording, read through `latest_properties`. Client-mintable UUIDs, owner
scoping. Observation ids are derived by `uuid5`, never the primary key.
Public build: everything above in memory for the tab lifetime, nothing
persisted, the recipe in the URL.

## Deliberately not yet

- **Expression dimensions** (dynamics/articulation reading) — deferred for
  scope, not feasibility: MIDI velocity and note-off timing assess them
  directly; the marks are *emitted* from L2 (§Generation step 4) so the
  material reads like real music, and they join the taxonomy with their own
  attribution rules later.
- **Other instruments** — guitar slots in as a new dimension set + hand
  analogues; nothing in the engines is piano-specific except the taxonomy,
  the hand model and the LH pattern classes.
- **Learned difficulty / learned generation** — the attempt corpus this
  system produces is the prerequisite; collect first (and see the IRT
  caveat).
- **Audio assessment** — recordings-workstream extraction, later.
- **Hand crossing, pedaling, ornament reading, clef changes** — the
  model-gated rungs and deferred features named above; taxonomy grows by
  evidence.
- **A printable set** — designed as SR4 (a page of N recipes with
  sequential sub-seeds at A4/Letter width, `breaks: 'encoded'`, header =
  short code · level · key · tempo, footer = the recipe URL, `window.print()`);
  an infinite book that cannot be printed is not a book replacement.
- **Video/audio of attempts** — an attempt is a recording, so the model
  admits an audio track; the player does not chase it.

## Implementation seeds (for grooming)

| Seed | Scope | Tier |
|---|---|---|
| Taxonomy module (dimensions, rung keys, labels, presets, coupling rules, normalizer, derived dimensions) + scorer (operational definitions, note tags, feature vector, versioning) + `theory/keys.ts` extraction + boundary fixtures | pattern-setter; the shared contract | T3 |
| Generator thin slice (skeleton, rhythm-per-phrase, motif/pattern realization, legality, verify with occurrence floor, coherence, candidate ranking, recipes, sub-seed streams) — `hands: 'rh' | 'lh'` single line at the lowest rungs | the algorithmic heart | T3 |
| Generator breadth: LH pattern classes, `hands.together` relations, full rhythm grammars, expression decoration, anacrusis and complement, relaxation stages, 12/16/20/24-bar forms | | T3 |
| Exercise player view: preview → count-in → play → self-report; attempt lifecycle; `useMetronome` clock contract; recipe URL; `subjectFromExercise`; public build ephemeral | consumes `renderScoreDoc` (SC1) | T2 |
| Web MIDI capture + SMF encode + offline matcher + attribution + verdicts as a virtual layer; works on the public build | assessment backbone | T2 |
| Exercises/attempts/recordings persistence + API; matcher run posted as a completed client run; observation projection | standard CRUD plus the run body | T1 |
| Calibrator v1 (continuous θ, graded success, placement, session policy, never-repeat, replay) + `ability_snapshots` | legible ladder, manual override | T2 |
| Printable set | after the player | T1 |

## F2 review — what changed and why (2026-09-02)

1. **Ladders re-cut.** Wrong orders fixed: triplets were the top rhythm
   rung (eighth triplets arrive mid-ladder; quarter-note triplets,
   dotted-eighth–sixteenth and compound duplets are later); ties across the
   barline were above offbeat quarters (they are easier); 2/4 was harder
   than 3/4; cut time preceded 6/8; "courtesy accidentals" was a reading
   rung (it is an engraving convention that lowers difficulty); A minor sat
   at the lowest key rung with no accidentals allowed (unsatisfiable with
   "resolve leading tones"); `hands.together` skipped the beginner
   progression (alternating hands, one hand sustaining) and contradicted
   `hands.lh_pattern` rung 1; held dyads came after a moving LH line; the
   interval ladder had a hole from the 6th to the octave; `pitch.range`
   conflated hand position, ledger-line reading and clef; hand crossing was
   a rung and simultaneously deferred; inversions were a density rung.
2. **Dimensions added / split:** `pitch.ledger` and `pitch.clef` replace
   `pitch.range`; `texture.voices`, `motion.patterns` added; density,
   ledger, intervals and position are per hand (the doc's own example
   vector — "L3 left hand" — was inexpressible); `DimId` vs `DimKey` makes
   the 15/19 split explicit.
3. **Every rung names its feature condition**, with shared definitions
   (onset, beat grid and strength, staff-step spans, hand model, written
   accidental, run, phrase end, window, rung selection) and a per-dimension
   table with a Tags column; "note-value entropy" is gone (16 sixteenths and
   4 quarters both have zero entropy); value classes are level-relative so
   2/2 and 6/8 score consistently; syncopation is computed on the rational
   timeline, not from `tie` fields; ties merge for rhythm/hands features and
   not for value/density features; nulls, per-voice aggregation, owners and
   exact-rational arithmetic are stated; fixtures are hand-scored against
   the table, never against the scorer.
4. **Level presets exist** (provisional, ABRSM-anchored from memory) with
   tempo bands in beat bpm, shortest-value floors that a sixteenth can
   clear inside every band, lengths, harmonic rhythm, count-in, anacrusis
   and hands rules; the table is closed under the coupling rules (the
   critic pass caught L4 R3/S2 and L7 I5/Q4, now R2 and I4) and monotone.
5. **Coupling rules are data** (`CouplingRule` with ids, floor-raising,
   ceiling-lowering and null consequents) and `normalizeSpec` is an
   algorithm with a stated iteration order and result types; derived
   dimensions (key, meter, hands-alone) come from the spec scalars; preset
   expansion never relaxes. Focus/comfort semantics and the occurrence
   floor (`measuresAtMax`) replace the undefined "target band".
6. **Tempo** is a preset parameter checked at verify and locked per
   attempt, with credit scaled by tempo ratio — the same notes at 60 and
   132 bpm are not the same exercise. Hand span (Δ ≤ 7) is an invariant,
   not a spec escape hatch.
7. **Coherence contract** (form for every legal length and hands mode,
   motif, contour, hand position, harmony, rhythm, marks) plus
   rhythm-per-phrase and a deterministic candidate ranking; the previous
   pipeline produced unreadable note-salad under simulation. Expression
   marks are emitted unscored — "assessable only via audio" was false.
8. **Recipes pin `scorerVersion` and `taxonomyVersion`**, use per-candidate
   PRNG streams and are carried verbatim in `ScoreMeta.recipe`; the re-roll
   budget, relaxation order and failure type are specified; ScoreDocs carry
   a short code; recipes are URLs; the initial tempo lives on `doc.tempo`.
9. **Assessment specified:** attempt lifecycle with a mandatory metronome
   and a look-through phase; the `useMetronome` clock contract; a MIDI
   attempt *is* a recording (one home for the raw log, on the recording
   clock, in quarter-bpm SMF terms); expected onsets from `soundingEvents`
   (tie-merged, chord-collapsed — Verovio's timemap counts tie-stops as
   onsets); offline monotone alignment with a resync model; IOI-scaled
   windows; verdict schema with `wrong-octave` and `corrected`; hesitation
   kinds; attribution with a look-ahead window, error-kind priors, note
   tags on every dimension, the cascade rule and per-phrase credit; extras
   anchored by `scoreTime`; hands undetectable from one MIDI stream.
10. **Provenance reconciled:** the matcher is a **client-executed** run
    posted complete; run subject = the recording; params carry `scoreId` and
    `scoreDocHash`, the server folds `inputSha256s` into the key; verdicts
    are never stored on `attempts`; the verdict layer is virtual;
    `alignment_map` has one payload shape and clock.
11. **Calibration specified:** continuous θ with a logistic expected score
    and hysteresis display; graded evidence for every exercised dimension
    from every attempt; `nEff` with decay; tiered self-report; placement;
    session policy with numbers and a group constraint; never-repeat with
    `exposure`; override handling; replay as the definition of ability,
    executed on the client; the observation record with one namespace;
    `attempts` lose soft delete in favour of void; item-calibrated IRT is
    ruled out honestly.
12. **Product surface:** exercises are subjects; the public build runs MIDI
    assessment in memory; groups and labels for the 15-dimension vector;
    the printable set is a seed; `POST /v1/exercises` writes both rows.
13. **Grooming consequences** (applied in the grooming doc): SR1 seeded with
    the taxonomy module, presets, coupling data, normalizer, scorer and
    `theory/keys.ts`; SR5 depends on SC1 not SC2 and touches `Score.tsx`
    only; SR6 on SC3 not SC5 and encodes the SMF; SR7 uploads it; SB7's
    `MidiRecorder`/`smf.ts` gain options; PV1 accepts client-executed runs,
    keys `subject_id` as `str`, folds `input_sha256s` into the hash and
    allow-lists `midi-matcher`, `scorer`, `musicxml-import`; RC1 gains
    `offset_ms`, optional subjects and MIDI-only recordings.
