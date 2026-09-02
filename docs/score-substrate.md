# The score substrate: representation, rendering, annotation, editing

> **Reviewed 2026-09-02 (F1).** Adversarial pass over §ScoreDoc shape,
> §Rendering pipeline, §Anchors and the annotation model and §Persistence,
> against the *actual* behaviour of Verovio 4.5.1 (probed under node; every
> "verified 4.5.1" claim below cites a script in
> [`docs/probes/verovio/`](probes/verovio/README.md)) and against the three
> consumer docs. The amendments are folded into the text; the end of the doc
> lists what changed and why. SC1 is seeded from this version.

Every roadmap workstream lands on the same surface: a score on a screen.
Sight-reading generation emits scores, OMR will produce scores, practice
recordings annotate against scores, assessment paints results onto scores,
and the sheet-music UX workstream *is* scores. Today that surface is
render-only — hand-written ABC strings pushed through Verovio
(`app/src/verovio/toolkit.ts`), with measure-rect overlays
(`app/src/verovio/heatmap.ts`) as the only interaction. There is no stable
way to *address* a note, no way to *mutate* a score, and no way to *persist*
anything drawn on one.

This doc decides the canonical score model and the layered architecture over
it. The end-state ambition it designs for is a **full notation editor**
(WYSIWYG entry and editing), reached by stages — but the near-term payoff is
addressability: stable element identity is what makes annotations,
assessment overlays, and playback cursors all possible with one mechanism.

Companion docs: [sight-reading-generation.md](sight-reading-generation.md)
(emits the model defined here), [recordings-provenance.md](recordings-provenance.md)
(anchors annotations to time instead of elements; shares the annotation
model defined here), [sketchbook.md](sketchbook.md) (attaches native and
foreign scores to ideas).

## Why our own AST, not ABC, MEI, or MusicXML as the canonical model

| Candidate | What it's good at | Why it can't be canonical |
|---|---|---|
| **ABC strings** (status quo) | Compact, hand-writable, already emitted programmatically (`chord-identity.ts` `toAbc`, `data/scales/engraving.ts`) | No element identity in the source: Verovio mints ids for ABC input, and they are stable only per (input bytes, Verovio build) when rendered with `xmlIdChecksum` (verified 4.5.1, `exp05`). Editing means text surgery. Grand-staff piano writing strains ABC's voice model. Render-only format. |
| **Raw MEI** | Full CWMN expressivity; Verovio-native; we control `xml:id` | XML manipulation in TS is miserable; zod can't validate it; the full MEI schema is enormous; it would be the only XML-canonical model in a codebase whose house pattern is typed TS documents. An editor over raw MEI is an editor over a DOM, not over a domain model. |
| **MusicXML** | Universal interchange (MuseScore, OMR tools export it) | An interchange format, not a working model — even more verbose than MEI, and Verovio imports it by converting to MEI internally (no export back). Same XML pain. |
| **ScoreDoc — our own TS AST** ✅ | Typed, zod-validated, JSON-serializable (JSONB in Postgres), mutable by commands, app-minted ids on every element | We must write and maintain a serializer to MEI and grow the model deliberately. That cost is the price of the editor ambition, and it's the cost this codebase has paid twice before, successfully. |

The house precedent is decisive. `ChordIdentity` is exactly this pattern —
"persist the source, derive the rest": a small semantic TS document, validated
on both sides of the contract, from which engravings are *derived* (its
`toAbc`). The sargam work (`app/src/data/raga/`, see
[world-notation.md](world-notation.md)) proved the bigger version: a
declarative notation AST plus a renderer, scoped deliberately, growing by
evidence. **ScoreDoc is the third instance of the same idea**, aimed at the
five-line staff.

The one thing ScoreDoc adds that neither precedent needed: **every semantic
element carries an app-minted id, and that id survives all the way to the
pixels.** ScoreDoc → MEI serialization writes our ids as `xml:id`; Verovio
preserves `xml:id` from MEI input into the ids of the SVG elements it
renders. So a note's id is the same string in the database row, the MEI, the
`<g>` in the DOM, the timemap entry (for notes), the annotation anchor, and
the MIDI assessment verdict. That single property is what the whole substrate
hangs on — and it is why the native rendering path must be MEI, not ABC.

**Verified against Verovio 4.5.1 (`exp01`, `exp03`):** every MEI event and
control event we emit renders as exactly one `<g id="<our id>"
class="<mei element name>">` — note, chord (containing its notes), rest,
mRest, space, tuplet, beam, artic, slur, tie, dynam, hairpin, tempo, dir,
fing, fermata, clef, keySig, meterSig, measure, staff, layer, section. Two
qualifications shape the rest of this doc: elements of `<scoreDef>`
(staffDef, staffGrp) are never rendered and carry no id; and **only note ids
reach the timemap** — chord, tuplet, rest, grace and tempo ids never appear
in `on`/`off` (`exp02`), so everything time-related is derived from ScoreDoc
by the app (§Score-time), and the timemap is consumed by id, only by the
cursor.

## Two tiers: native and foreign scores

We are not going to model all of Common Western Music Notation up front —
that's how notation projects die. Scores come in two tiers:

- **Native scores** are ScoreDoc-backed: editable, generatable, fully
  addressable. The v1 model scope is what generation, drills, and sketches
  actually need: grand staff (two staves, one part), up to two voices per
  staff, standard durations (whole through 32nd, up to two dots, simple
  un-nested tuplets), ties, slurs, accidentals with correct spelling and
  cautionary accidentals, key and time signatures, one tempo mark per
  measure, dynamics and hairpins, articulations, fingering numbers, a pickup
  measure, forced system breaks.
- **Foreign scores** are imported artifacts — MusicXML or MEI files, ABC,
  eventually OMR output and plain PDF/photos. They render via Verovio
  directly (or display as images, for PDFs), and they are **annotatable but
  not editable**. Foreign renders always pass `xmlIdChecksum: true`, so a
  Verovio-minted element id is a pure function of the artifact bytes and the
  Verovio build (verified 4.5.1, `exp05`: default minting differs on every
  load; with the checksum it is identical across loads and instances and
  changes only when the bytes change). MusicXML `id` attributes and foreign
  MEI `xml:id`s are kept verbatim (`exp15`). Element anchors on foreign
  scores therefore record the render key they were made against (§Anchors);
  measure-index anchors remain the recommended coarse form.

The **promotion path** keeps the editor ambition honest without boiling the
ocean: an importer covering the native subset promotes a foreign score to
native when everything in it fits the model. Anything outside the subset
stays foreign until the model deliberately grows. Generated exercises and
hand-entered sketches are born native; the Chopin you import from MuseScore
starts foreign. Promotion **creates a new native row** (`derived_from`) — the
foreign row and its bytes are immortal (§Persistence). Importers are
producers under the provenance contract: `musicxml-import` (lossless within
the subset, else refuses), later `midi-quantize` (lossy, parameterised:
grid, hand split, key, meter) and `omr`; a promoted doc records its producer
and input hash in `meta.provenance`.

## ScoreDoc shape

Containment mirrors MEI for events (measure → staff → voice → events), so
serialization is a tree-walk plus two deterministic passes the serializer
owns: beam grouping and the hoisting of control events (ties, slurs,
hairpins, dynamics, fingering, tempo) to measure level, which is where MEI
and Verovio put them (verified `exp01`: `slur`, `tie`, `dynam`, `tempo`,
`fing`, `hairpin`, `dir` all render as children of the *measure*, not the
note). The v1 model, which the implementing ticket turns into the zod schema
in `app/src/score/schema.ts`:

```ts
interface ScoreDoc {
  schemaVersion: 1;
  id: string;                     // UUID — equals the scores.id row (see §Identity)
  revision: number;               // bumped by every persisted command batch; 1 at creation
  meta: ScoreMeta;                // closed object, see below
  staves: StaffDef[];             // piano v1: exactly two
  keySig: KeySig; timeSig: TimeSig; tempo: Tempo;   // REQUIRED initial state → <scoreDef>
  measures: Measure[];            // ≥ 1
}

interface ScoreMeta {
  title: string;
  source: 'generated' | 'authored' | 'imported';
  recipe?: { generatorVersion: string; scorerVersion: string; taxonomyVersion: string;
             specHash: string; seed: number };            // required iff source === 'generated'
  provenance?: { runId: string; extractor: string; extractorVersion: string;
                 inputSha256s: string[] };                 // required iff source === 'imported'
  derivedFrom?: { scoreId: string; scoreDocHash: string };  // forks, promotions, clones
}

interface StaffDef { id: ElementId; clef: 'treble' | 'bass'; hand: 'rh' | 'lh' }  // hands distinct

interface KeySig { fifths: -7|-6|-5|-4|-3|-2|-1|0|1|2|3|4|5|6|7; mode: 'major' | 'minor' }
interface TimeSig { count: number; unit: 2 | 4 | 8 | 16; sym?: 'common' | 'cut'; grouping?: number[] }
interface Tempo   { bpm: number; unit: Duration }         // bpm is an integer 20..300

interface Measure {
  id: ElementId;
  pickup?: true;                  // anacrusis; allowed on measures[0] only; MEI metcon="false"
  systemBreak?: true;             // a forced system break BEFORE this measure; MEI <sb/>
  keySig?: KeySig; timeSig?: TimeSig; tempo?: Tempo;      // a CHANGE taking effect at this measure
  staves: MeasureStaff[];         // index-aligned with doc.staves, exactly staves.length entries
  spanners: Spanner[];            // slurs and hairpins that START in this measure
  directions: Direction[];        // dynamics attached to an event in this measure
}

interface MeasureStaff { voices: Voice[] }                // 1..2 entries, distinct n, sorted by n
interface Voice { id: ElementId; n: 1 | 2; events: Event[] }   // n = MEI layer @n; ≥ 1 event

type Event = Note | Chord | Rest | MeasureRest | TupletGroup;   // discriminated on `kind`

type DurBase = 1 | 2 | 4 | 8 | 16 | 32;                   // MEI @dur
interface Duration { base: DurBase; dots: 0 | 1 | 2 }

interface SpelledPitch {
  step: 'A'|'B'|'C'|'D'|'E'|'F'|'G'; alter: -2|-1|0|1|2;
  octave: number;                 // scientific: C4 = middle C = MIDI 60 (identical to MEI @oct)
}
type Articulation = 'staccato' | 'accent' | 'tenuto' | 'marcato' | 'staccatissimo';
type Finger = 1 | 2 | 3 | 4 | 5;
type TieRole = 'start' | 'stop' | 'both';                 // MEI i | t | m

interface Note {
  kind: 'note'; id: ElementId;
  pitch: SpelledPitch; duration: Duration;
  tie?: TieRole; courtesy?: true; articulations?: Articulation[]; fingering?: Finger;
}
interface ChordNote {                                     // MEI <note> inside <chord>: no @dur
  id: ElementId; pitch: SpelledPitch;
  tie?: TieRole; courtesy?: true; fingering?: Finger;
}
interface Chord {
  kind: 'chord'; id: ElementId; duration: Duration;
  notes: ChordNote[];             // ≥ 2, ascending by (octave, step, alter), distinct pitches
  articulations?: Articulation[];
}
interface Rest        { kind: 'rest'; id: ElementId; duration: Duration }
interface MeasureRest { kind: 'measureRest'; id: ElementId }   // MEI <mRest/>; the only event in its voice
interface TupletGroup {
  kind: 'tuplet'; id: ElementId;
  num: number; numbase: number;   // MEI @num/@numbase: num in the time of numbase, e.g. 3:2
  events: (Note | Chord | Rest)[]; // ≥ 2; no nested tuplets in v1
}

type Spanner =
  | { kind: 'slur';    id: ElementId; startId: ElementId; endId: ElementId }
  | { kind: 'hairpin'; id: ElementId; startId: ElementId; endId: ElementId; form: 'cres' | 'dim' };
type Direction =
  | { kind: 'dynamic'; id: ElementId; at: ElementId; value: 'pp'|'p'|'mp'|'mf'|'f'|'ff' };
```

### Identity

- **A ScoreDoc's identity is its row.** `ScoreDoc.id` is the `scores.id`
  UUID (client-mintable, the `PKMixin` convention), never a ULID. A
  generated exercise mints it deterministically —
  `uuid5(SOUNDINGS_NS, canonicalJson(recipe))` — so regenerating a recipe
  is idempotent against `scores` and `exercises`. Annotation targets and the
  `score:<uuid>` subject id (§Persistence) carry the same string, on the
  public build (no row) and the homelab build alike.
- **Element ids are NCName-safe, kind-prefixed strings** minted through an
  injected `IdSource`, never by the model itself:

  ```ts
  type ElementId = string;   // /^[a-z]{1,2}[0-9a-z]{10}(?:-[a-z0-9]+)*$/
  interface IdSource { next(kind: ElementKind): ElementId }
  export function seededIdSource(rng: () => number): IdSource;   // generator: deterministic per recipe
  export function randomIdSource(): IdSource;                    // editor, importer: crypto.getRandomValues
  ```

  Prefixes: `m` measure, `v` voice, `n` note and chord note, `c` chord,
  `r` rest, `mr` measure rest, `t` tuplet, `sl` slur, `hp` hairpin, `dy`
  dynamic, `sd` staff def. Ids are unique across the whole document (all
  kinds pooled; zod `superRefine`), never reused within it, never derived
  from position, and belong to their element for life (undo restores the
  same ids). Why not ULIDs or UUIDs: a ULID embeds a clock, which the
  generator's "no clock, same recipe same notes" rule forbids; both usually
  start with a digit, which `xml:id` (an NCName) forbids — Verovio passes
  digit-leading ids through unharmed (verified `exp04`), so the rule is
  about schema-valid MEI, interchange, and `#id` CSS selectors, not
  rendering. Resolvers use `[id="…"]` attribute selectors regardless.
- **Derived elements get derived ids** — the one explicit exception to
  "never derived from position": elements the serializer *creates* (beams,
  per-measure `<staff>`, the tie element, articulation and fingering
  children, the scoreDef) get ids computed from their owner — beam →
  `${firstMember.id}-beam`, tie → `${startNote.id}-tie`, articulation *i* →
  `${note.id}-a${i}`, fingering → `${note.id}-fing`, staff → `${measure.id}-s${n}`.
  Without this, Verovio mints random ids for exactly these groups on every
  render (`exp01`, `exp11`), and byte-identical SVG is impossible.
- **Copies re-mint.** `cloneScoreDoc(doc)` mints a new document UUID and
  re-mints every element id (returning the old→new map so a caller may
  carry annotations across deliberately), and sets `meta.derivedFrom`.
  Uniqueness is per document; anchors are always scoped by their target.

### Rules that matter more than the field list

- **Pitch is absolute; the serializer owns the written/gestural split.**
  `alter` is the sounding alteration with the key signature already applied
  (ScoreDoc spells every note). `toMei()` **always** emits `accid.ges`
  when `alter ≠ 0` — Verovio does not apply the key signature or bar
  carry-over to sounding pitch: an unmarked F in G major sounds as F♮, and
  a plain C after a C♯ in the same bar sounds as C♮ (verified 4.5.1,
  `exp12`, `exp18`). The written accidental (`@accid`, `s|f|n|x|ff`) is
  emitted separately by `accidentalState()`: when the note's alter differs
  from the key signature's alter for that letter, or from an earlier written
  accidental on the same letter and octave in the same measure and staff
  (naturals included). `courtesy: true` forces a cautionary accidental
  (`<accid func="caution">`, drawn in parentheses) and is a zod error on a
  note that would be written anyway. The scorer imports the same
  `accidentalState()` so it never disagrees with the engraving.
- **Durations are rational, never floats.** `Fraction { num; den }` in
  whole-note units, always reduced, compared by cross-multiplication.
  `durationOf(d, tuplet?) = (1/base) × (2 − 2^−dots) × (numbase/num)`.
  Measures are full: every voice's durations sum exactly to the meter in
  effect; a `pickup` measure sums to strictly less. Verovio enforces none
  of this — an overfull bar renders and silently shifts every later onset
  (`exp19`) — so it is the schema's job (§Validity). Verovio's timemap
  reports tuplet positions as IEEE floats and rounds `tstamp` to integer
  ms (`exp02`); it is joined by id, never compared against model positions.
- **Ties pair by rule, not by reference.** A note or chord note with
  `tie: 'start' | 'both'` pairs with the *next* Note/ChordNote of identical
  spelled pitch in the same staff and same `Voice.n`, crossing at most one
  barline; that note **must** carry `'stop' | 'both'`; a dangling tie is a
  zod error. Verovio pairs `@tie` only within one layer number and drops a
  cross-layer tie with a console warning. The serializer emits the element
  form `<tie xml:id startid endid>` in the start measure (attribute-form
  ties get a random id, `exp11`). **A tied chain is one sounding event**,
  identified by the tie-start id: Verovio's timemap lists every tie-stop
  note as a fresh onset while its own MIDI export merges the chain
  (`exp11`), so the expected-onset grid is never taken from the timemap.
- **Voice identity across measures is `Voice.n`**, the MEI layer number;
  `Voice.id` identifies this voice-in-this-measure (anchorable, selectable).
  A staff may carry only `n: 2` in a measure; when both voices are present
  the serializer sets `stem.dir` up/down by `n`. Two voices per staff is a
  v1 limit.
- **Initial state lives on the document, changes on the measure.**
  `doc.keySig/timeSig/tempo` go into the initial `<scoreDef>`; a measure
  carrying a change gets a `<scoreDef>` before it (key/meter) or a
  `<tempo tstamp="1">` inside it. Effective state at a measure is the last
  explicit value at or before it (`effectiveAttrs(doc, measureId)`).
  Verovio silently assumes 120 bpm when no tempo is encoded (`exp17`), which
  is why tempo is required.
- **Tempo is normalized to quarter-note terms by the serializer.**
  `quarterBpm = bpm × quarterLength(unit)`; `toMei()` writes
  `<tempo midi.bpm="{quarterBpm}" mm="{bpm}" mm.unit="{base}" mm.dots="{dots}">`
  plus `scoreDef@midi.bpm` for the first measure. `midi.bpm` is what
  Verovio times by; `mm.*` is display only — Verovio computes a dotted
  `mm.unit` as 4/3 instead of 3/2 (♩. = 60 runs at 80 qpm, not 90;
  `exp17`), and it applies any mid-measure tempo change from the bar start
  (`exp02`). One tempo mark per measure, at beat 1, is therefore the model.
  The beat unit the metronome clicks is `beatUnit(timeSig)`: a dotted
  `(unit/2)`-note when `unit ≥ 8 && count % 3 === 0`, else the `unit`-note
  — the rule `lib/time.ts beatsPerBar` already encodes; `TimeSig.grouping`
  (e.g. `[2,3]` for 5/8) drives beaming and the accent pattern.
- **Deterministic serialization**: the same ScoreDoc produces byte-identical
  MEI (stable attribute order, `xml:id` on every element the serializer
  emits, a `meiHead` always — Verovio warns without one, `exp19`), and
  `renderScoreDoc` produces byte-identical SVG by re-setting `xmlIdSeed`
  before every `loadData` (Verovio re-seeds its id RNG on `setOptions`;
  the seed set once at construction is consumed by the first load —
  `exp20`, `exp21`). Snapshot tests pin both the MEI and the SVG.
- **Beaming is mandatory and derived, not modeled.** Verovio does not beam
  MEI input at all — eighths without `<beam>` render flagged in 4/4 and 6/8
  (`exp09`; the ABC importer beams by spacing, which is why the legacy path
  looks fine). `groupBeams(voice, timeSig)` runs per voice per measure with
  the beat-group table for the v1 meters (2/4, 3/4, 4/4, 5/4: quarter
  groups; 2/2: half groups; 3/8, 6/8, 9/8, 12/8: dotted-quarter groups; 5/8
  and 7/8 by `grouping`): consecutive events shorter than a quarter within
  one beat group form a `<beam>`; a rest or a quarter-or-longer breaks it;
  inside a tuplet the tuplet is the outer container and beams form inside
  it (both nestings render and time correctly, `exp09`). Beam ids are
  derived, never stored, and never legal anchors. Manual overrides are E3.
- **Canonical JSON and content hash.** `canonicalJson(doc)` is RFC 8785
  (JCS) — sorted keys, no whitespace, `undefined` omitted — computed in TS
  (`app/src/lib/canonical-json.ts`); `scoreDocHash(doc) =
  sha256(canonicalJson(doc without revision))`. Every provenance run that
  consumes a score names `scoreDocHash` in `input_sha256s` and references
  `{ scoreId, scoreDocHash }` in `params` — never the document body. The
  backend stores the client-computed hash and never recomputes it (Python
  never re-derives what TS owns).
- **Cardinalities** (all zod, each with a negative snapshot test):
  `staves.length === 2`, `measures.length ≥ 1`, `measure.staves.length ===
  staves.length`, `1 ≤ voices.length ≤ 2` with distinct `n`,
  `events.length ≥ 1` (a silent voice holds one `MeasureRest`),
  `chord.notes.length ≥ 2`, `tuplet.events.length ≥ 2`.

### Score-time and the timeline

The doc's consumers need one definition of *when* an event happens. Score
time is quarter-note units as an exact `Fraction` from the start of the
score — the same unit as Verovio's `qstamp`, without its floats.

```ts
interface TimelineEvent {          // one per Note, ChordNote, Rest, MeasureRest
  id: ElementId; measureId: ElementId; measureIndex: number;
  staffIndex: 0 | 1; hand: 'rh' | 'lh'; voiceN: 1 | 2;
  onset: Fraction; beat: Fraction; duration: Fraction;   // absolute, measure-relative, notated
  sounding: boolean;               // false for rests and tie-stop notes
}
interface SoundingEvent {          // tie-merged, chord-collapsed, rest-free; the assessment grid
  id: ElementId;                   // the Note or Chord that starts the sound (tie-start)
  onset: Fraction; tiedDuration: Fraction;
  staffIndex: 0 | 1; hand: 'rh' | 'lh'; voiceN: 1 | 2;
  pitches: Array<{ noteId: ElementId; midi: number; tiedNoteIds: ElementId[] }>;
}
export function timeline(doc: ScoreDoc): TimelineEvent[];        // app/src/score/timeline.ts
export function soundingEvents(doc: ScoreDoc): SoundingEvent[];
export function msAt(t: Fraction, quarterBpm: number): number;   // t × 60000 / quarterBpm
export function midiOf(p: SpelledPitch): number;                  // 12 × (octave + 1) + pc(step) + alter
```

A measure's onset is the sum of `count × 4/unit` of every preceding
measure's effective meter (a pickup contributes its actual length); a
voice's onsets accumulate rational durations, tuplets scaling their members
by `numbase/num`. **`timeline()` / `soundingEvents()` are the only source
of expected onsets** — for MIDI assessment, for the generator's verify
pass, for score↔recording alignment, and for the `scoreTime` anchor. The
Verovio timemap is consumed only by the CursorLayer, only for note ids and
`measureOn`, and only for the render it came with; a fixture test asserts
`timeline()` onsets equal Verovio `qstamp` within 1e-6 for every fixture so
the two views are proven consistent. Verovio omits grace notes from the
timemap entirely (`exp02`), so any future ornament event kind ships with its
own timing clause here.

### Validity

Verovio validates nothing: overfull and underfull voices, a missing staff, a
note with no duration, a tuplet without a ratio, duplicate `xml:id`s, a
bad pitch name and an unknown element all load with `loadData → 1` and an
empty `getLog()` (`exp19`, `exp08`; every warning goes to the console and
is not capturable). The schema is therefore the only gate. `ScoreDocSchema`
(structural zod) plus `validateScoreDoc(doc): Issue[]` (semantic
refinements) live in `app/src/score/schema.ts`; `renderScoreDoc` throws on
an invalid document and treats `loadData === false` as an internal error,
never as validation. Refinements, all mandatory in v1:

1. Every id in the document is unique and matches the `ElementId` pattern.
2. Per measure, per voice, durations (with tuplet ratios) sum exactly to the
   effective meter; a `pickup` measure sums to the same value strictly less
   than the meter in every voice.
3. `measures[i].staves` has exactly `staves.length` entries; voices have
   distinct ascending `n`; a `MeasureRest` is alone in its voice.
4. Every Note/Rest/Chord carries a duration; chord notes carry none; chord
   notes have distinct pitches.
5. A tuplet's nominal member durations sum to `num × u`, `u` the largest
   power-of-two duration ≤ every member's nominal duration.
6. Tie pairing per the rule above; spanner `startId`/`endId` and direction
   `at` resolve to a Note, ChordNote or Chord (rests are not endpoints); a
   slur starts strictly before it ends; a spanner lives in the measure of
   its start element.
7. `courtesy` only on notes that would otherwise print no accidental;
   `fingering`, `alter`, `octave` in range; `pickup` and `systemBreak` never
   on the same measure as each other's illegal positions (`pickup` only on
   `measures[0]`; `systemBreak` never on `measures[0]`).

The generator's verify step runs `validateScoreDoc` before the scorer; the
importer runs it as the promotion gate; every editor command runs it on the
post-state and is rejected on any issue.

## Rendering pipeline

```
native:   ScoreDoc ──toMei()──▶ MEI ──renderScoreDoc()──▶ SVG + timemap
                                        (toolkit.ts: new entry)
foreign:  MusicXML / MEI / ABC ─────────renderToSvg()───────▶ SVG   (+ xmlIdChecksum)
legacy:   ABC (drills, thumbnails) ─────renderToSvg()───────▶ SVG   (unchanged)
```

`app/src/verovio/toolkit.ts` already supports `inputFrom: 'mei'`
(verified: `inputFrom` is the 4.5.1 option name; the old `from` is not,
`exp21`). It gains one entry, `renderScoreDoc(doc, { widthPx })`, with
these rules, each backed by a probe:

- **Reset before set.** The toolkit is shared and `setOptions` merges
  without resetting — a `pageWidth` or `svgHtml5` set by one caller
  persists into the next DEFAULTS-shaped call (`exp21`). Every render calls
  `tk.resetOptions()` first; the ABC helpers are updated to do the same.
- **Never `svgHtml5`.** It replaces every `id=` with `data-id=` and breaks
  every `[id="…"]` lookup (`exp14b`).
- **One page, wrapped systems.** `breaks: 'encoded'` honours the
  ScoreDoc's `systemBreak` marks (the generator sets one every four bars so
  phrases are lines); `pageWidth = widthPx × 100 / scale`, a tall
  `pageHeight` and `adjustPageHeight: true` so the whole score is one page;
  `renderScoreDoc` asserts `getPageCount() === 1` and throws otherwise. Under
  the thumbnail defaults a 32-bar exercise is one 4975 px-wide system, and
  with a bounded page `renderToSVG(1)` silently omits every element on later
  pages (`exp13b`, `exp21`) — anchors, cursor and hit-testing would all fail
  for the second half. Pagination is a non-goal until a page-scale need
  arrives; at that point the resolver walks pages via `getPageWithElement`.
- **Determinism.** `xmlIdSeed: <fixed constant>` in the options set before
  every load (see §Rules); foreign renders use `xmlIdChecksum: true`
  instead.
- **Timemap with rests.** `renderToTimemap({ includeMeasures: true,
  includeRests: true })` so rest ids are addressable in time (`restsOn` /
  `restsOff`); the cursor ignores them unless a tool asks.
- **Windowed re-render** (the escape hatch for page-scale scores) maps
  `measureIds: { start, end }` onto `tk.select({ start, end })`, which
  4.5.1 accepts for measure ids but not note ids (`exp06`); the positional
  `measureRange: "a-b"` string stays for legacy ABC only, because Verovio
  interprets it as 1-based document position, not `@n`, and a range it
  cannot find is silently ignored and the whole score rendered (`exp20`).
  Under a window the selected elements keep their ids, the timemap keeps
  **absolute** score time (measures 5–8 start at the full score's 8000 ms)
  and unselected ids report "not found" (`exp06`) — so the CursorLayer
  offsets its clock by the first entry's `tstamp`, and the resolver
  distinguishes *unrendered* (in the doc, not on screen) from *orphaned*.
- **Foreign labels.** Foreign renders set `svgAdditionalAttribute:
  ['measure@n']` so the gutter can show encoded measure numbers as
  `data-n` (`exp14`); native measures need nothing (the ScoreDoc knows).
- **Performance.** A 32-bar grand-staff exercise with beams, chords, slurs
  and dynamics loads, renders and timemaps in roughly 60–120 ms (`exp21`) —
  "milliseconds" per command holds, though not keystroke-rate.

`getMEI()` output is normalized and non-deterministic (attribute order
rewritten, PIs added, random ids stamped on every unlabeled element,
`exp07`); it is a debugging aid and a parsing front end for the importer
(`loadData(musicxml)` + `getMEI()` under `xmlIdChecksum`), never something
we persist or feed back into a native document. Verovio's `edit()` /
`editInfo()` are never called; `toolkit.ts` does not export them.

The existing ABC paths (library thumbnails, drills, piece views) keep
working untouched; they migrate to ScoreDoc opportunistically, not as a
project. The sargam substrate explicitly stays its own renderer per
[world-notation.md](world-notation.md); the substrate is a property of the
annotation *target*, not the anchor (§Anchors), so cross-substrate marks
remain possible without retrofitting the union.

## Anchors and the annotation model

This is the load-bearing contract shared with both companion docs. An
**anchor** says *where* something attaches; an **annotation** is the thing
attached; a **layer** groups annotations for toggling and attribution.

```ts
type Q = Fraction;                                   // score time, quarter notes, exact

type Anchor =
  | { kind: 'elements'; ids: ElementId[];             // semantic set: notehead, chord, rest, measureRest, measure ids only
      render?: { verovio: string; inputSha256: string } }   // required on foreign targets: the id validity key
  | { kind: 'span'; from: ElementId; to: ElementId }  // inclusive range in one voice; membership computed at resolve time
  | { kind: 'measures'; fromId: ElementId; toId: ElementId }   // native: measure ids, inclusive
  | { kind: 'measureIndex'; from: number; to: number }         // foreign + bundled pieces: 1-based document order of the FULL render
  | { kind: 'scoreTime'; from: Q; to?: Q; staffIndex?: 0 | 1 } // positions without an element: extras, hesitations, projected audio
  | { kind: 'region'; frame: RegionFrame; x: number; y: number; w: number; h: number }
  | { kind: 'timeRange'; startMs: number; endMs: number; trackId?: string };   // recordings, on the recording clock

type RegionFrame =
  | { kind: 'measure'; measureId: ElementId; staffIndex: 0 | 1 }   // native
  | { kind: 'measureIndex'; index: number; staffIndex: 0 | 1 }     // foreign staff scores
  | { kind: 'page'; page: number };                                 // PDF/photo artifacts (1-based)

type TargetKind = 'score' | 'piece' | 'recording';
interface Target { kind: TargetKind; id: string }    // score → scores.id (native or foreign); piece → bundled PIECES[].id slug; recording → recordings.id

type Body =
  | { kind: 'text'; text: string }
  | { kind: 'highlight'; color: 'coral' | 'krill' | 'lumen' | 'ink' }          // theme tokens, never hex
  | { kind: 'symbol'; symbol: 'circle' | 'check' | 'cross' | 'star' | 'breath' | 'pedal'; label?: string }
  | { kind: 'ink'; strokes: Array<{ points: Array<[x: number, y: number, p?: number]> }>; width?: number }  // region-frame space
  | { kind: 'verdict'; verdict: 'correct' | 'corrected' | 'wrong-pitch' | 'wrong-octave' | 'missed' | 'extra';
      expectedMidi?: number; playedMidi?: number; onsetDeltaMs?: number; cascade?: boolean }
  | { kind: 'tempo'; ratio: number; label?: string }                            // local ÷ target over the anchored span
  | { kind: 'heat'; value: number; label?: string };                            // 0..1

interface Layer {
  id: string;                    // UUID (mixins)
  target: Target;
  key: string;                   // stable slug, unique per (user, target, key): 'user:default', 'assessment', 'heat', …
  name: string; role: 'user' | 'system';
  position: number;              // z-order ascending; system layers 0..99, user layers 100+
  defaultVisible: boolean;
  createdAt: string; updatedAt: string;
}

interface Annotation {           // persisted rows are user-authored; see EphemeralAnnotation
  id: string;                    // UUID (mixins)
  layerId: string;               // the layer carries the target
  anchor: Anchor; body: Body;
  author: { kind: 'user'; userId: string };
  scoreRevision?: number;        // the ScoreDoc.revision it was made against (score targets)
  createdAt: string; updatedAt: string;
}

/** Machine marks: a pure projection of a provenance property, rebuilt on load, never POSTed. */
interface EphemeralAnnotation {
  id: string; layerId: string; anchor: Anchor; body: Body;
  author: { kind: 'system'; runId: string | null; producer: string };   // runId null only on the public build
}
```

Decisions inside this contract:

- **Ids in `elements` are notehead, chord, rest, measure-rest and measure
  ids only** — never voice, staff, beam, tuplet, slur or section ids (the
  selection model maps a click on those to the enclosing legal element).
  Verdicts anchor to notehead ids (`Note.id` or `ChordNote.id`): a chord id
  never appears in the timemap and never carries a verdict; it resolves to
  the union of its noteheads for human marks.
- **Native scores never anchor by measure number.** `measures` walks
  `ScoreDoc.measures` by id, so `insertMeasure`/`deleteMeasure` never move
  an existing anchor; `measureIndex` is illegal on `score` targets (zod +
  API 422) and means 1-based document order of `g.measure` in the *full*
  render — never the encoded `@n` (MusicXML pickups are `0`, ABC has none)
  and never a partial render (`heatmap.ts` indexes the currently rendered
  list, which is off by the window start after a `select`; `exp06`). The
  resolver keeps an `index → id` map from the full render.
- **`scoreTime` is the anchor for things with no element**: an `extra`
  played note, a hesitation span, a projected audio range. Geometry: the x
  of the last timeline event at or before `from` and of the next event in
  that measure's SVG group, interpolated; y from the staff box (or the
  system when `staffIndex` is absent). Only legal on `score` targets. The
  recordings doc's alignment bridge projects `timeRange ↔ scoreTime`; "no
  new annotation kinds" there is true because this kind exists from day one.
- **Region anchors are staff-relative, not bbox-relative.** `x ∈ [0,1]`
  across the measure (left to right barline); `y` in staff-spaces from the
  top line of the named staff (0 = top line, 4 = bottom; values outside are
  allowed). The resolver derives the box from the five staff-line `<path>`s
  under `<g class="staff">`, never from `getBBox()` of the measure group —
  that box spans both staves and every attached control event, and moves by
  100–1000 units when a fingering, tempo text or ledger-line note is added
  to *unrelated* content (`exp16`). `ink` strokes use the same frame space.
- **`timeRange` is on the recording clock**: t = 0 is `recordings.captured_at`;
  every `recording_tracks` row carries `offset_ms` (audio: `MediaRecorder`
  start; MIDI: first count-in click or first event) so a track-local time is
  converted by adding its offset. `trackId` only says which lane to draw in.
  (Amends the recordings doc and RC1.)
- **Foreign element ids are valid for one (input sha256, Verovio version)
  pair.** An `elements` anchor on a `piece` or foreign `score` carries
  `render`; the resolver compares it to the artifact's sha and
  `tk.getVersion()` and reports `stale-render` on mismatch (gutter, like an
  orphan). MusicXML sources with their own ids survive re-renders and
  Verovio bumps.
- **Geometry is never stored for element anchors.** Position is resolved at
  render time by id lookup in the SVG. For spanning elements (slur, tie,
  hairpin) the resolver selects `[id="X"], .id-X` and unions the boxes —
  after a system break Verovio emits continuation groups without an `id`,
  tagged `class="<kind> id-X spanning"` (`exp13c`). Annotations therefore
  survive re-layout, zoom, page-size changes, and any edit that doesn't
  delete the anchored elements.
- **Orphan status is computed at resolve time, never stored.** The resolver
  returns per annotation `{ status: 'resolved' | 'partial' | 'unrendered' |
  'orphaned' | 'stale-render' | 'stale-run'; missingIds }`: `partial` = some
  ids resolved (drawn, with a gutter badge); `unrendered` = in the doc but
  outside the current window (nothing drawn, no badge); `orphaned` = no id
  in the *ScoreDoc* (drawn only in the gutter — orphaning is decided
  against the document, never against a selector returning nothing);
  `stale-run` = a system projection whose run's `input_sha256s` no longer
  includes the target's `scoreDocHash`. Re-anchoring is a `PATCH` with a new
  anchor and is legal only for user annotations; system marks are never
  edited — a new run supersedes them. Discard = soft delete. Undo of a
  delete restores the same ids, so an accidental delete + undo un-orphans
  automatically.
- **Machine marks and human marks share one renderer and one toggle UI,
  but not one store.** Human marks are `annotations` rows. Machine marks —
  MIDI assessment verdicts (sight-reading doc), extraction outputs
  (recordings doc), the section heatmap — are **virtual system layers**:
  projected at read time from the newest succeeded run's property (or from
  bundled data) by `projectLayer(property): EphemeralAnnotation[]`, keyed
  `key: 'assessment'` etc. with a run picker for older runs. Nothing is
  written to `annotations` for them; supersession is the provenance rule
  ("newest succeeded run per extractor and kind"), the public build gets
  them with no backend, and a recompute never doubles rows. Persist the
  source, derive the rest. (A persisted system row would need exactly one
  run behind it; v1 has no such producer.)
- **Compatibility is explicit.** Anchor × target: `elements` on `score`, and
  on `piece`/foreign with `render`; `span`, `measures`, `scoreTime` on
  `score` only; `measureIndex` on `piece`/foreign only; `region` with frame
  `measure` on native, `measureIndex` on foreign staff scores, `page` on
  image artifacts; `timeRange` on `recording` only. Body × anchor: `text`
  anywhere; `highlight` on elements/span/measures/measureIndex/scoreTime/
  timeRange; `symbol` on a single element or a region; `ink` on region
  only; `verdict` on exactly one notehead (or `scoreTime` for `extra`);
  `tempo` on scoreTime/timeRange; `heat` on measures/measureIndex/
  timeRange. The zod schema encodes both tables; the API returns 422.
- **Ownership is not authorship.** `user_id` (mixin) is tenancy and is
  always the current user; `author` is who made the mark. Users cannot
  create layers with a reserved system `key`, and an annotation's
  `author.kind` must equal its layer's `role` (422 otherwise).
- **Mutable sketches vs immutable exercises.** Ids survive edits by design,
  so a user mark on a note stays attached after the note is re-pitched;
  `scoreRevision` lets the gutter say "placed at rev 3" as information, not
  as an orphan. `scores` rows born from a recipe (`meta.source ===
  'generated'`) are immutable; opening one in the editor forks it
  (§Editing).

## The ScoreSurface component stack

The UI over the libraries is a stack of coordinated layers, each already
foreshadowed by existing code:

```
ScoreSurface
├── EngravingLayer      Verovio SVG, read-only            (Score.tsx grows into this)
├── AnnotationLayer     overlays injected into the engraving groups after every render
├── InteractionLayer    hit-testing → ScoreDoc ids, selection model, tool modes
└── CursorLayer         timemap playback cursor            (SessionScore.tsx pattern)
```

- **Overlays are injected, and re-injected after every render.** Verovio's
  SVG nests an inner `<svg viewBox>` and a `page-margin` transform, so a
  sibling overlay would need CTM math; the `heatmap.ts` pattern (query the
  group, `getBBox()`, insert a child `<g class="annotation" data-annotation-id>`
  with `pointer-events: none`) keeps coordinates in Verovio's own space and
  follows re-layout for free. The engraving SVG is replaced wholesale on
  every render (`dangerouslySetInnerHTML`), so annotation, selection and
  cursor state are keyed by ScoreDoc ids and re-resolved through an
  `onRendered(svg, revision)` callback that replaces `onSvgReady`.
- **Hit-testing walks up to the nearest ancestor whose id is in the
  ScoreDoc id set** — never `closest('[id]')`: Verovio gives stems, flags,
  dots, accidentals, articulations, tuplet brackets and numbers, barlines,
  clefs, signatures and staff/system groups their own random ids, and a
  notehead's `<g>` has none (`exp10`). Precedence: notehead → its Note or
  ChordNote (Shift promotes to the Chord); a chord's shared stem, flag or
  dots → the Chord; a beam polygon → the enclosing Measure (beams are not
  anchorable); ledger lines, barlines, clefs and signatures → the enclosing
  Measure. `kind` comes from the ScoreDoc index, never from the SVG class.
  `onElementClick(id, kind)` in `Score.tsx` is replaced, not generalized.
- **Selection model**: `{ kind: 'elements'; ids }` or `{ kind: 'range';
  from: ScoreTime; to: ScoreTime; staffIndexes?; voiceN? }` (half-open, in
  score time from `timeline()`); `resolveSelection(doc, sel)` yields ids.
  Render order is layers by `position`, then annotations by `createdAt`;
  overlays never intercept clicks except annotation groups of the active
  layer in `select` mode.
- **CursorLayer**: consumes the timemap by id (`on`/`off`/`measureOn`);
  treats an `on` for a tie-stop note as continuation (highlight moves, no
  onset flash) and lights a chord by lighting its notes; takes
  `encodedBpm` from the ScoreDoc's tempo, never from `subject.bpmTarget`;
  offsets its clock by the first rendered entry's `tstamp` under a window;
  advances through bars of rests because silent measures still produce a
  `measureOn` entry (`exp17`).
- **Tool modes**: `select` | `annotate:text` | `annotate:highlight` |
  `annotate:symbol`, with `edit` and `annotate:ink` arriving in later
  stages. Desktop-first (the primary practice/marking device is the
  laptop): hover affordances, keyboard shortcuts, precise click targets.
  Ink is deferred but the `region` anchor + `ink` body mean the data model
  won't need to change when a pencil shows up.

## Editing: staged path to the full editor

The ambition is a real editor. The path there front-loads what generation
and practice need and defers pure-engraving polish:

- **E0 — render + annotate** (this doc's immediate scope): ScoreSurface,
  anchors, layers, persistence. No mutation of notes.
- **E1 — structured entry**: a cursor + duration palette writing `Event`s
  into a `Voice`, and **MIDI step-entry** (hardware exists; Web MIDI API,
  desktop Chrome) — play a note, it lands at the cursor with the selected
  duration. This is enough to author exercises and sketches from scratch.
- **E2 — selection edits**: transpose, delete, re-duration, copy/paste
  across measures, voice operations.
- **E3 — engraving control**: manual beaming, breaks, spacing overrides.
  Only if genuinely needed; Verovio's defaults are good.

**Commands are data, and `apply` is pure.** Every mutation is a plain-JSON
command; `apply(doc, cmd) → { doc, inverse }` never mutates its input, runs
`validateScoreDoc` on the result and throws `CommandError(issues)` leaving
the document untouched. The editor keeps `{ undo: Command[]; redo:
Command[] }` in memory only; persistence is the whole document (§Persistence)
and the command log is explicitly *not* persisted — it is the named input
for a future sync engine. The v1 catalogue:

```ts
type Command =
  | { type: 'insertEvents'; at: Cursor; events: Event[] }          // events carry pre-minted ids; overwrite semantics
  | { type: 'deleteEvents'; ids: ElementId[] }                       // replaced by rests of equal duration, never shifted
  | { type: 'replaceEvents'; ids: ElementId[]; events: Event[] }    // re-duration, pitch edit, transpose
  | { type: 'insertMeasure'; afterId: ElementId | null; measure: Measure }   // arrives full of rests
  | { type: 'deleteMeasure'; id: ElementId }
  | { type: 'setMeasureAttrs'; id: ElementId; keySig?: KeySig | null; timeSig?: TimeSig | null; tempo?: Tempo | null; systemBreak?: boolean }
  | { type: 'addSpanner'; measureId: ElementId; spanner: Spanner } | { type: 'removeSpanner'; id: ElementId }
  | { type: 'batch'; commands: Command[] };                          // paste, transpose-selection, voice ops
interface Cursor { measureId: ElementId; staffIndex: 0 | 1; voiceN: 1 | 2; index: number }   // index === events.length is the gap after the last event
```

Rules: (1) native measures are always full — `insertMeasure` and a new voice
arrive filled with rests; (2) entry **overwrites** (MuseScore semantics):
`insertEvents` consumes the event at `index` and following rests until the
entered duration is covered, splitting a longer rest into the remainder, and
is rejected when the duration exceeds the measure's remaining capacity (no
auto-carry across barlines in v1); (3) `deleteEvents` also removes every
spanner or direction that references a deleted id and records them in the
inverse, and drops a tie whose partner is deleted; (4) `deleteMeasure` of
the first measure and `insertMeasure(null)` carry the effective signatures
so the document stays valid; (5) **undo restores the original ids** (the
inverse of a delete carries the removed subtree verbatim) so do → undo →
redo is id-stable; (6) **paste re-mints** every id, remaps spanner endpoints
inside the clipboard and drops spanners that cross its boundary —
annotations never follow a copy; Verovio renders duplicate `xml:id`s
without complaint and fires them twice in the timemap (`exp08`), so this is
the schema's uniqueness rule in action; (7) MIDI step entry forms one
`Chord` from keys pressed while the first is held or within 40 ms;
(8) spelling has one owner — `app/src/score/pitch.ts` exports
`spellMidi(midi, keySig, prefer)` and `transposePitch(pitch, semitones,
keySig)`, used by step entry, the MIDI→ScoreDoc importer, the generator's
legality pass and the `transpose` batch; (9) **generated exercises are
immutable** — opening one in the editor forks it into a new `scores` row
(`meta.source: 'authored'`, `meta.derivedFrom` set, element ids preserved
so verdicts on the exercise stay on the exercise).

After each command the surface re-renders through Verovio; at exercise
scale (8–32 bars) this is on the order of 100 ms (`exp21`). If page-scale
scores make it sluggish, windowed re-rendering by measure ids (§Rendering)
is the escape hatch — measure first, optimize second.

## Persistence and the two shapes

- **Scores — one table, two tiers.** Every score, native or foreign, is one
  `scores` row on the standard mixins:

  ```
  scores  kind native|foreign · title · source generated|authored|imported
          schema_version int NULL (native; server-extracted on write)
          version int NOT NULL DEFAULT 1            -- optimistic concurrency
          doc DocumentJSON NULL                     -- native only; the ScoreDoc, opaque to the server
          doc_sha256 char(64) NULL                  -- client-computed scoreDocHash, stored verbatim
          format musicxml|mei|abc|pdf|image NULL    -- foreign only
          storage_key · mime · bytes · sha256       -- foreign only, the media store's StoredBlob
          derived_from_score_id uuid NULL           -- promotion / fork lineage
          CHECK ((kind='native') = (doc IS NOT NULL)); CHECK ((kind='foreign') = (storage_key IS NOT NULL))
  ```

  `DocumentJSON` is the `saved_chords.identity` `JSON().with_variant(JSONB)`
  precedent at document scale. **A ScoreDoc lives only in `scores.doc`**: a
  generated exercise is a `scores` row plus `exercises.score_id` (the recipe
  and feature vector stay on `exercises`); an idea's native harmony or
  melody attachment, when that later feature lands, is likewise a `scores`
  row referenced from the idea — not a JSONB column on `idea_assets`, which
  stays a bytes table. `Annotation.target.kind === 'score'` always names a
  `scores.id`. Derived MEI and SVG are never stored (persist the source,
  derive the rest); if a server-side consumer ever needs MEI it lands as a
  derived asset with a `run_id`.
- **Scores are subjects.** `SubjectKind` gains `'score'`; the subject id is
  the string `score:<uuid>` (SB4's `idea:<uuid>` convention). Recordings,
  practice sessions, collections and extraction runs address a score
  through that string — so `extraction_runs.subject_id` is `str`, not
  `uuid` (amends PV1; RC1 already says `str`).
- **Whole-document saves with an integer version.** `PUT /v1/scores/{id}`
  carries `{ doc, version }`; a mismatch returns 409 problem+json with the
  current version and the client reloads and replays its unsaved commands.
  `updated_at` cannot do this job (one-second resolution on SQLite,
  transaction time on Postgres). Autosave is debounced and sends the whole
  document; annotations and layers are last-write-wins.
- **Blobs are upgraded on read, in TS, never by Alembic.**
  `app/src/score/migrate.ts` applies `v(n) → v(n+1)` steps until
  `schemaVersion` is current; a doc saved back is always current; one
  fixture per historical version stays in the snapshot suite. The server
  stores `schema_version` so old rows are countable and a client-side
  backfill can page through them; it accepts any `schemaVersion ≤ current`
  and rejects newer with 422. Alembic adds columns and indexes; it never
  rewrites `doc`.
- **Contract ownership.** `Anchor` is server-owned: a Pydantic discriminated
  union on `kind`, mirrored by the TS type and guarded by an `Assignable`
  test like `ChordIdentity`; the server enforces the anchor × target table.
  `body` is an opaque dict on the server with a required string `kind`; its
  variants are TS-owned. `ScoreDoc` is opaque on the server with a validated
  envelope (`schemaVersion`, `id`, `revision`, `meta`, a size cap
  `score_max_doc_bytes`, default 8 MB → 413); the zod schema is the only full
  validator. openapi.json exposes the envelope, so `contract.test.ts` stays
  satisfied.
- **API surface** (camelCase DTOs, `Page[T]` where listed, contract
  regenerated in the same PR):

  ```
  GET/POST  /v1/scores                       Page[ScoreSummary] (never inlines doc) · {id?, doc} → 201
  POST      /v1/scores/import                multipart file + format → 201 (foreign; SC7)
  GET       /v1/scores/{id}                  ScoreRead (doc inline for native; blob fields for foreign)
  GET       /v1/scores/{id}/content          streaming bytes, ETag = sha256 (foreign only)
  PUT       /v1/scores/{id}                  {doc, version} → 200 | 409
  POST      /v1/scores/{id}/promote          → 201 new native row, derived_from set (SC8)
  DELETE    /v1/scores/{id}                  204 soft
  GET/POST  /v1/targets/{kind}/{id}/layers   unpaged · {id?, key, name, defaultVisible?} (role=user) → 201
  PATCH/DELETE /v1/layers/{id}               name/defaultVisible/position · 204 soft, annotations soft-deleted in the same tx
  GET       /v1/targets/{kind}/{id}/annotations   unpaged (cap 10 000 → 413), ?layerId=
  POST      /v1/layers/{id}/annotations      {id?, anchor, body} → 201 (author = user)
  PATCH/DELETE /v1/annotations/{id}          anchor/body/layerId (same target only) · 204 soft
  ```

  Layers and annotations are reachable only through a live target (404 when
  it is missing or soft-deleted); no cascade write on target delete, so
  restoring a target restores its marks. `annotations.target_kind/target_id`
  are denormalised from the layer on create and read-only on the wire.
- **Promotion creates a new row.** The foreign row and its bytes stay;
  `measureIndex` layers and annotations are copied to the native row as
  `measures` anchors (the importer preserves measure order); `elements` and
  `region` annotations stay on the foreign row.
- **Two stores, one interface.** `app/src/annotations/store.ts` defines
  `AnnotationStore` with `ApiAnnotationStore` behind `backendEnabled` and
  `MemoryAnnotationStore` otherwise (also the vitest double, and the home of
  every projected system layer). Never `localStorage` — the public build
  persists nothing across reloads, and `config.test.ts` proves the score,
  timeline and annotation modules import nothing from `api/`.
- **Two shapes** ([DEPLOYMENT.md](../DEPLOYMENT.md)): the public build
  renders bundled scores exactly as today and paints virtual layers (the
  section heatmap over `piece` targets with `measureIndex` anchors parsed
  once from `Section.range`; sight-reading verdicts over in-memory
  exercises); scores/annotations persistence gates on `backendEnabled` like
  saved chords.

## Design decisions worth knowing

- **One engraver.** Verovio stays the only staff renderer; no VexFlow/OSMD
  second stack. Its MEI `xml:id` passthrough + timemap is the property the
  whole architecture rests on, and it's already paid for (~3 MB WASM,
  loaded once). What it does *not* do — validate, beam, apply key
  signatures to pitch, merge ties in the timemap, keep ids stable without a
  seed — is the app's job, and is written down above with the probe that
  proved it.
- **The editor edits ScoreDoc, never MEI/SVG.** MEI is a compilation
  target. This is what keeps the editor tractable.
- **Native scope grows by evidence,** the sargam way — each addition to the
  model (new event kind, new notation feature) arrives with a real need, a
  serializer clause, a snapshot test, a `migrate.ts` step when the JSON
  shape changes, and a timing clause when Verovio's timemap does not cover
  it.
- **Annotations are anchored semantically, positioned at render time.**
  Never persist pixel geometry against element anchors.
- **System output is a projection.** Anything that wants to mark a score
  (assessment, extraction, heatmaps) is a provenance property rendered
  through the same layer mechanism — no bespoke overlay paths, no second
  copy of derived data.

## Deliberately not yet

- **Ink/pencil marking** — modeled (`region` + `ink` body), not built;
  desktop-first for now.
- **Clef changes, cross-staff notes and beams, 8va lines** — a note always
  engraves on the staff of its voice with that staff's clef; hand crossing
  in generated material is encoded by pitch and detected by the scorer from
  `StaffDef.hand`; imported scores using these stay foreign. Inline
  `<clef>` with an id is verified to render (`exp01`), so the addition is a
  small one when repertoire needs it.
- **Grace notes, ornaments, fermatas, breath marks, pedal marks, text
  expressions, breve/64th values, more than two dots, nested tuplets,
  repeats and endings, multi-measure rests** — outside the native subset;
  imported scores using them stay foreign.
- **Sargam unification** — separate substrate by prior decision; a future
  `composition` target kind would carry its own anchor kinds (a matra
  range); nothing in the union needs retrofitting.
- **Collaborative editing / CRDTs** — single-tenant app; the offline-ready
  columns and the integer version are as far as we go.
- **MNX** — watched, not adopted; MEI-via-Verovio is proven here today.
- **Server-side rendering** — stays client-side per the `ChordIdentity`
  rule until a real batch need arrives, at which point Verovio-in-Python
  behind the job boundary is the named path, fed by a stored derived-MEI
  asset with a run behind it.
- **PDF/photo display and OMR** — foreign-tier citizens by design; the
  capture/storage half lives in the recordings doc's media machinery, and
  OMR-to-ScoreDoc promotion is future work on the importer.

## Implementation seeds (for grooming)

| Seed | Scope | Tier |
|---|---|---|
| ScoreDoc schema + zod + validity + `toMei()` + `timeline()` + `renderScoreDoc` + snapshot tests (MEI and SVG) | pattern-setter; the contract everything consumes | T3 |
| ScoreSurface stack (engraving/annotation/interaction/cursor layers) | refactor Score.tsx/heatmap.ts/SessionScore.tsx into the stack; hit-testing and selection per this doc | T2 |
| Anchor resolution + overlay renderer | every anchor kind → geometry, status enum, spanning-element union, virtual-layer projection | T2 |
| Scores + layers + annotations persistence (tables, versioned PUT, API, migration) | not "standard CRUD": polymorphic target, version check, contract ownership | T2 |
| Foreign score import + content streaming | `scores` kind foreign over `MediaStoreDep` | T1 |
| Section heatmap → virtual system layer | mechanical once projection exists | T0 |
| MusicXML→ScoreDoc importer (native subset), promotion path | new native row, lineage, annotation copy rules | T2 |
| E1 structured entry (cursor, palette, MIDI step-entry, `pitch.ts`) | first editor stage | T2 |

## F1 review — what changed and why (2026-09-02)

Every item below was found by the adversarial pass and either verified
against Verovio 4.5.1 (probe named) or traced to a contradiction with a
companion doc or the backend conventions. The corresponding text above is
already amended; this list exists so the ratifying reader can check the
reasoning without diffing.

1. **Ids.** ULIDs dropped: they embed a clock (breaks "same recipe, same
   notes") and are not NCNames. `ScoreDoc.id` = the row UUID; element ids
   are prefixed, injected-source strings; derived elements get derived ids.
   (`exp04`, `exp01`, `exp11`; the UUID `PKMixin` in `backend/app/models/base.py`.)
2. **Pitch.** `accid.ges` is mandatory for every altered note — Verovio
   does not apply the key signature to sounding pitch (`exp12`, `exp18`).
   Without this every F♯ in G major would be assessed as F♮.
3. **Ties.** Timemap lists tie-stops as onsets; MIDI merges them (`exp11`).
   Expected onsets come from `soundingEvents()`, never the timemap.
4. **Timemap coverage.** Only note ids are time-addressable; chord, tuplet,
   rest, grace and tempo ids never appear; `getTimeForElement` returns 0
   for both "not found" and "is a rest" (`exp02`, `exp03`). Hence
   §Score-time.
5. **Validation.** Verovio swallows overfull bars, missing staves, missing
   durations, duplicate ids and unknown elements silently (`exp19`,
   `exp08`). Hence §Validity.
6. **Beaming** is not automatic for MEI input (`exp09`) — the serializer's
   beam table is load-bearing, not stylistic.
7. **Tempo.** Dotted `mm.unit` is computed as 4/3; `midi.bpm` is honoured;
   mid-measure changes snap to the bar; no tempo means 120 (`exp17`). Tempo
   is required and normalized to quarter-note bpm.
8. **Determinism.** SVG differs on every load unless `xmlIdSeed` is re-set
   before each `loadData` or `xmlIdChecksum` is on (`exp20`, `exp21`);
   foreign ids are random per load by default (`exp05`).
9. **Toolkit state.** `setOptions` merges and persists across callers;
   `svgHtml5` deletes every id; `inputFrom` is the option name (`exp21`,
   `exp14b`).
10. **Layout.** Thumbnail defaults make a 32-bar score one 5000 px system;
    a bounded page silently drops later measures from page 1 (`exp13b`,
    `exp21`); spanning slurs/ties get id-less continuation groups
    (`exp13c`).
11. **Hit-testing.** `closest('[id]')` returns random Verovio ids for
    roughly half of a note's pixels (`exp10`).
12. **Region anchors.** The measure bbox drifts with unrelated content
    (`exp16`); regions are now staff-relative.
13. **Measure numbering.** Verovio's `measureRange` is positional and
    silently renders everything on a miss (`exp20`); native anchors use
    measure ids, foreign anchors use full-render document order.
14. **Model gaps closed:** Chord/ChordNote (verdicts need notehead ids),
    Rest/MeasureRest, TupletGroup, StaffDef with `hand`, KeySig `mode`,
    TimeSig `sym`/`grouping`, Tempo unit, `Voice.n`, spanners and dynamics
    at measure level (`exp01`), `courtesy`, `pickup`, `systemBreak`,
    `revision`, closed `meta` with recipe/provenance/derivedFrom, event
    `kind` discriminants, cardinalities.
15. **Anchor contract:** `span`, `measures`, `measureIndex`, `scoreTime`,
    region frames, `timeRange` clock and `offset_ms`, foreign render key;
    substrate tag moved to the target; bodies defined including `verdict`,
    `tempo`, `heat`; compatibility tables; orphan status enum; system marks
    are virtual projections (resolves supersession, the public build, and
    the double-home contradiction with the provenance doc).
16. **Persistence:** one `scores` table for both tiers (resolves the
    `scores` vs `exercises` vs idea-attachment three-homes contradiction);
    scores are subjects; integer version; read-time blob migration;
    contract ownership split; API sketch; promotion as a new row; two
    annotation stores; `extraction_runs.subject_id` becomes `str` (PV1).
17. **Editing:** serializable commands with pure `apply`, cursor and
    overwrite semantics, id-stable undo, paste re-mints, spelling module,
    generated exercises fork on edit, Verovio's editor API never used.
18. **Grooming consequences** (applied in the grooming doc): SC4 re-tiered
    to T2 and re-scoped to scores + layers + annotations; SC7 (foreign
    import) added; SC3 covers every anchor kind and the projection; SC6
    becomes a virtual layer; SR5 depends on SC1 not SC2; SR6 on SC3 not
    SC5; RC1 gains `offset_ms`; PV1 `subject_id` is `str`.
