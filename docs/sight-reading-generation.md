# Sight-reading generation: difficulty, taxonomy, generation, calibration

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
- The **generator** produces exercises to a spec: (version, spec, seed) →
  ScoreDoc. Deterministic — the recipe *is* the exercise.
- The **calibrator** turns attempt outcomes into a per-dimension ability
  estimate and picks the next spec. This is the adaptive loop.

The shared vocabulary — the **technique taxonomy** — is the real design
surface. Get it wrong and every exercise downstream is miscalibrated in a
way no test suite catches; that is why this doc exists before any code.

Everything here consumes [score-substrate.md](score-substrate.md): exercises
are native ScoreDocs, assessment verdicts land as system-layer annotations
on exact note ids, and expected timing derives from the model's rational
durations.

## The technique taxonomy (piano v1)

A **dimension** is an independently practicable skill with an ordinal ladder
of **rungs**. Dimensions are the contract between all three engines and the
UI ("this exercise pushes syncopation and left-hand leaps"). v1 keeps the
set small and orthogonal; it grows by evidence, not by completeness.

| Dimension | Rung ladder (low → high, abbreviated) |
|---|---|
| `pitch.range` | 5-finger position → one octave → ledger lines above/below → wide grand-staff span |
| `pitch.accidentals` | none → key-signature only → occasional courtesy → frequent chromatics |
| `pitch.key` | C/Am → 1 sharp/flat → 2–3 → 4+ and minor-mode variants |
| `rhythm.values` | whole–quarter → +eighths → +sixteenths, dotted → +tuplets |
| `rhythm.meter` | 4/4, 3/4 → 2/4, cut → 6/8 compound → 5/8, mixed |
| `rhythm.syncopation` | none → offbeat quarters → ties across beats → across barlines |
| `rhythm.rests` | beat-aligned only → offbeat rests → rests inside runs |
| `hands.together` | hands alone → homorhythm → 2:1 ratio → independent rhythms |
| `hands.lh_pattern` | held whole-note chords → broken/Alberti → walking line → independent voice |
| `texture.density` | single line → occasional intervals → triads → 4-note chords |
| `motion.intervals` | steps → thirds → mixed leaps ≤ 5th → leaps > octave |
| `motion.position` | fixed hand position → one shift per phrase → frequent shifts → hand crossing |

A **level** (L1–L10) is a named preset: a bundle of per-dimension rung
ceilings, loosely sanity-anchored to graded-syllabus expectations (ABRSM
1–8-ish) so the words mean something to a pianist. But levels are UI sugar —
**the system's real state is the per-dimension vector.** A player is not
"L4"; they are "L5 rhythm, L3 left hand, L4 everything else," and generation
targets exactly that shape. This is what "technique-tagged/targeted"
means concretely, and it's also how other instruments arrive later: guitar
is a different dimension set over the same machinery, not a fork.

## The difficulty model: transparent features, no ML

The scorer extracts objective features per dimension (range spans, interval
histograms, syncopation counts, note-value entropy, inter-hand rhythm
ratios, chord densities, implied position shifts), maps each to a rung on
that dimension's ladder, and reports the vector. An overall scalar (for
sorting and display) is a weighted aggregate — but the vector is the
product surface and the contract.

Deliberately **not** a learned model, for now: there is no training data,
and a learned scalar would be exactly the un-inspectable "grade 3-ish"
judgment we don't trust books for. The transparent scorer is testable
(hand-scored fixture exercises pin every rung boundary) and arguable — when
an exercise feels harder than its label, a specific rung mapping is wrong
and fixable. Meanwhile every attempt this system ever sees is logged
(below), which is precisely the corpus a learned difficulty model would
need — the option stays open at zero design cost.

The one rule that protects trust: **no dimension may exceed its ceiling
anywhere in an accepted exercise.** A "L3" exercise with one L6 measure is
how the player learns to distrust the labels. The scorer enforces ceilings
per-measure, not just on averages.

## Generation: constrain first, verify after

Input **spec**: per-dimension rung targets (the calibrator pushes 1–2
*focus* dimensions to the player's edge, holds the rest at comfort), key,
meter, length (8/16 bars), tempo target.

Pipeline, per attempt:

1. **Harmonic skeleton** — a level-gated progression grammar (I, IV, V, vi,
   ii… pools widening by `pitch.key` rung; cadence enforced at phrase ends;
   harmonic rhythm gated by level). Phrases are 4-bar units with an
   arch/descent contour template.
2. **Rhythm per hand** — weighted duration grammars fill each measure under
   the `rhythm.*` budgets; the `hands.together` rung controls the
   inter-hand relationship (homorhythm → 2:1 → independent), and
   `hands.lh_pattern` picks the LH realization class.
3. **Pitch realization** — RH: a tonal walk weighted over
   chord-tone/scale-tone/approach-tone choices, interval distribution
   constrained by `motion.intervals`, range by `pitch.range`, hand span ≤
   an octave unless the spec says otherwise, occasional motif repetition
   for musical coherence. LH: realized from its pattern class over the
   skeleton. Voice-leading sanity (resolve leading tones, no voice
   crossings) as hard constraints.
4. **Legality pass** — correct enharmonic spelling for the key, beaming per
   meter (the ScoreDoc serializer's job), courtesy accidentals.
5. **Verify** — run the scorer on the finished ScoreDoc. Accept iff every
   dimension lands in its target band and no measure breaches a ceiling.
   Otherwise re-roll (bounded, seeded attempts; then relax non-focus
   dimensions one notch and log the relaxation).

Generate-within-constraints *plus* verify-after is the belt and braces: the
grammars aim at the budgets, the scorer proves them. The two sides share
the taxonomy but not code paths, so a generator bug can't silently redefine
difficulty.

**Determinism**: seeded PRNG (mulberry32-class), no `Math.random`, no
clock. An exercise's **recipe** is `{generatorVersion, spec, seed}` — same
recipe, same notes, forever. We persist both the recipe *and* the resulting
ScoreDoc (rows are cheap; history must not break when the generator
versions), but the recipe is the identity.

**Rejected alternatives**:

- **LLM generation** — can't be trusted to hold hard constraints (ceilings
  are the product), non-deterministic, adds latency/cost to something a
  procedural generator does in microseconds. Possible later role:
  *musicality re-ranker* over accepted candidates. Never the constraint
  holder.
- **Corpus/Markov models** — need a curated, leveled corpus, which is the
  book problem again. Later option once our own attempt corpus exists.
- **Full CSP solver** — heavier machinery than 16 bars needs; weighted
  grammars + rejection hit the budgets with simpler, more tunable code.

## Where it runs: client-side TS, deliberately

The generator and scorer are pure TS modules (`app/src/generation/`),
because:

- The theory stack is already single-source in TS (`chord-identity.ts`,
  `@tonaljs`, the ABC engraving code) — the backend README's rule that
  Python never re-derives what TS owns applies squarely.
- ScoreDoc is TS-native; generation emits it directly.
- Pure + deterministic = trivially testable in vitest (recipe fixtures pin
  exact output).
- **It works on the public showcase build.** Generation needs no server, so
  sight-reading becomes a flagship feature of the static shape — generate,
  render, play with the metronome, self-report. Only *persistence* and
  *calibration memory* gate on `backendEnabled` ([DEPLOYMENT.md](../DEPLOYMENT.md)).

The backend stores recipes, exercises, and attempts when enabled — plain
CRUD on the standard mixins, no music logic. music21-on-the-server stays
reserved behind the future job boundary for genuinely heavy batch work
(none identified yet).

## Assessment: MIDI-first, honest fallback

MIDI hardware exists (USB/BT), so assessment is objective from day one:

- **Capture**: Web MIDI API, desktop Chrome (the primary device). Count-in
  from the existing metronome (`useMetronome`); the expected onset grid
  comes straight from the ScoreDoc's rational durations at the target
  tempo — element ids included, no Verovio needed for timing.
- **Matching**: greedy anchor-based alignment of played events to expected
  events within onset windows — a score-follower-lite. Verdicts per
  expected note: `correct | wrong-pitch | missed | extra`, plus timing
  deltas; local tempo dips vs the metronome flag *hesitations* (the real
  currency of sight-reading assessment).
- **Attribution**: each error debits the taxonomy dimensions active at that
  moment — a flubbed note inside a sixteenth run debits `rhythm.values`
  and `motion.intervals` per what made that moment hard. Attribution rules
  are part of the scorer's versioned surface.
- **Display**: verdicts render as a **system annotation layer**
  ([score-substrate.md](score-substrate.md)) — wrong notes painted on the
  exact noteheads by id, one mechanism shared with every other overlay.
- **Provenance**: the raw MIDI event log is stored; the matcher is just an
  extractor in the [recordings-provenance.md](recordings-provenance.md)
  contract (run id, matcher version, params hash) — verdicts are
  recomputable when the matcher improves, and attempts never lose their
  ground truth.

**No-MIDI fallback**: self-report (`clean | rough | fell apart`) keeps the
loop alive acoustically and on the public build. Audio-based assessment is
explicitly deferred to the recordings workstream's extraction stack.

## Calibration: legible v1, log for the future

Per-dimension ability = current rung + confidence. The v1 update rule is a
deliberately simple ladder (Elo-lite, per dimension): clean attempts with a
dimension in focus build promotion evidence; repeated failures attributed
to a dimension build demotion evidence; confidence decays with inactivity.
Session policy: mostly consolidation at level, 1–2 focus dimensions pushed
one rung, occasional easy confidence reps.

Two rules imported from the wider system design:

- **Observations are sacred, beliefs are disposable.** Every attempt is
  stored as an observation-shaped event with a stable id (uuid5 over the
  attempt row) — exportable to the crucible evidence log when that
  integration un-defers. Ability estimates are app-side beliefs: quarantined,
  never exported, always recomputable from the observation log. A smarter
  model (IRT/BKT) later re-reads the same log.
- **The calibrator never blocks the player.** Manual spec override (pick
  your own level/focus) is always available; adaptation is a default, not
  a cage.

## Persistence

| Table | Contents |
|---|---|
| `exercises` | recipe (JSONB) + ScoreDoc (JSONB) + scorer feature vector + versions |
| `attempts` | exercise ref, mode (midi/self-report), raw MIDI ref, result (JSONB), matcher/scorer versions |
| `ability_snapshots` | periodic per-dimension vector (belief cache; recomputable) |

All on the standard mixins (client-mintable UUIDs, soft delete, owner).
Public build: generate + play + self-report, ephemeral, nothing persisted.

## Deliberately not yet

- **Expression dimensions** (dynamics/articulation obedience) — assessable
  only via audio; waits for the extraction stack.
- **Other instruments** — guitar slots in as a new dimension set + LH/RH
  analogues; nothing in the engines is piano-specific except the taxonomy
  and the LH pattern classes.
- **Learned difficulty / learned generation** — the attempt corpus this
  system produces is the prerequisite; collect first.
- **Audio assessment** — recordings-workstream extraction, later.
- **Pedaling, hand-crossing, ornament reading** — taxonomy grows by
  evidence.

## Implementation seeds (for grooming)

| Seed | Scope | Tier |
|---|---|---|
| Taxonomy + scorer (features → rungs, fixtures pin boundaries) | pattern-setter; the shared contract | T3 |
| Generator core (grammars, realization, verify loop, seeded PRNG) | the algorithmic heart | T3 |
| Exercise player view (render, metronome count-in, flow) | consumes ScoreSurface | T2 |
| Web MIDI capture + matcher + verdict annotations | assessment backbone | T2 |
| Recipes/attempts persistence + API | standard CRUD | T1 |
| Calibrator v1 + session policy | legible ladder, manual override | T2 |
| Public-build showcase wiring (ephemeral mode) | config-gated | T1 |
