# The score substrate: representation, rendering, annotation, editing

> **Reviewed 2026-09-02 (F1).** Adversarial pass over §ScoreDoc shape,
> §Rendering pipeline, §Anchors and the annotation model and §Persistence,
> against the *actual* behaviour of Verovio 4.5.1 (probed under node; every
> "verified 4.5.1" claim below cites a script in
> [`docs/probes/verovio/`](probes/verovio/README.md)) and against the three
> consumer docs, followed by a six-lens critic pass over the amended text.
> The amendments are folded into the text; the end of the doc lists what
> changed and why. SC1 is seeded from this version.

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
| **ABC strings** (status quo) | Compact, hand-writable, already emitted programmatically (`chord-identity.ts` `toAbc`, `data/scales/engraving.ts`) | No element identity in the source: Verovio mints ids for ABC input, and they are stable only when the toolkit is seeded — per (input bytes, Verovio build) under `xmlIdChecksum`, or per seed under a re-set `xmlIdSeed` (verified 4.5.1, `exp05`; cross-build stability untested). Editing means text surgery. Grand-staff piano writing strains ABC's voice model. Render-only format. |
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

**Verified against Verovio 4.5.1 (`exp01`, `exp03`, `exp04`):** every MEI
event and control event we emit renders as exactly one `<g id="<our id>"
class="<mei element name>">` — note, chord (containing its notes), rest,
mRest, space, tuplet, beam, artic, slur, tie, dynam, hairpin, tempo, dir,
fing, fermata, clef, keySig, meterSig, measure, staff, layer, section
(section renders as `class="section systemMilestone"` plus a random-id
`systemMilestoneEnd` group — match classes by token, never by equality).
Two qualifications shape the rest of this doc: elements of `<scoreDef>`
(staffDef, staffGrp) are never rendered and carry no id; and **only note ids
reach the timemap** — chord, tuplet, rest (unless `includeRests`), measure
rest, grace and tempo ids never appear in `on`/`off` (`exp02`, `exp22`), so
everything time-related is derived from ScoreDoc by the app (§Score-time),
and the timemap is consumed by id, only by the cursor.

## Two tiers: native and foreign scores

We are not going to model all of Common Western Music Notation up front —
that's how notation projects die. Scores come in two tiers:

- **Native scores** are ScoreDoc-backed: editable, generatable, fully
  addressable. The v1 model scope is what generation, drills, and sketches
  actually need: grand staff (two staves, one part), up to two voices per
  staff, standard durations (whole through 32nd, up to two dots, simple
  un-nested tuplets), ties, slurs, accidentals with correct spelling and
  cautionary accidentals, key and time signatures from a closed set, one
  tempo mark per measure with a display text, dynamics and hairpins,
  articulations, fingering numbers, a pickup measure with its complement,
  forced system breaks.
- **Foreign scores** are imported artifacts — MusicXML or MEI files, ABC,
  eventually OMR output and plain PDF/photos. They render via Verovio
  directly (or display as images, for PDFs), and they are **annotatable but
  not editable**. Foreign renders always pass `xmlIdChecksum: true`, so a
  Verovio-minted element id is a pure function of the artifact bytes and the
  Verovio build (verified 4.5.1, `exp05`: default minting differs on every
  load; with the checksum it is identical across loads and instances and
  changes only when the bytes change). MusicXML `id` attributes (`exp15`)
  and foreign MEI `xml:id`s (`exp01`, `exp04`) are kept verbatim. Element
  anchors on foreign scores therefore record the render key they were made
  against (§Anchors); measure-index anchors remain the recommended coarse
  form.

The **promotion path** keeps the editor ambition honest without boiling the
ocean: an importer covering the native subset promotes a foreign score to
native when everything in it fits the model. Anything outside the subset
stays foreign until the model deliberately grows. Generated exercises and
hand-entered sketches are born native; the Chopin you import from MuseScore
starts foreign. Promotion **creates a new native row** (`derived_from`) — the
foreign row and its bytes are immortal (§Persistence). Importers are
producers under the provenance contract: `musicxml-import` (lossless within
the subset, else refuses), later `midi-quantize` (lossy, parameterised:
grid, hand split, key, meter) and `omr`; each posts its run as a
client-executed run (recordings doc) before writing `meta.provenance` into
the promoted doc.

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
interface Fraction { num: number; den: number }        // den > 0, always reduced; compared by cross-multiplication
type ElementKind = 'measure' | 'voice' | 'note' | 'chord' | 'rest' | 'measureRest' | 'tuplet'
                 | 'slur' | 'hairpin' | 'dynamic' | 'staffDef';
type ElementId = string;                                // stored ids match /^[a-z]{1,2}[0-9a-z]{10}$/ exactly (see §Identity)

interface ScoreDoc {
  schemaVersion: 1;
  id: string;                     // UUID — equals the scores.id row (see §Identity)
  revision: number;               // bumped by every persisted command batch; 1 at creation
  meta: ScoreMeta;                // closed object (zod .strict())
  staves: StaffDef[];             // piano v1: exactly two
  keySig: KeySig; timeSig: TimeSig; tempo: Tempo;   // REQUIRED initial state → <scoreDef>; never repeated on measures[0]
  measures: Measure[];            // ≥ 1
}

interface ScoreMeta {
  title: string;
  source: 'generated' | 'authored' | 'imported';
  recipe?: Recipe;                // the sight-reading doc's Recipe { generatorVersion; scorerVersion; taxonomyVersion; spec; seed }
                                  // verbatim — full spec inline, never a hash; required iff source === 'generated'
  provenance?: { runId: string; extractor: string; extractorVersion: string;
                 inputSha256s: string[] };                 // required iff source === 'imported'
  derivedFrom?: { scoreId: string; hash: string };         // scoreDocHash of a native parent, blob sha256 of a foreign parent
}

interface StaffDef { id: ElementId; clef: 'treble' | 'bass'; hand: 'rh' | 'lh' }  // hands distinct

interface KeySig { fifths: -7|-6|-5|-4|-3|-2|-1|0|1|2|3|4|5|6|7; mode: 'major' | 'minor' }
interface TimeSig { count: number; unit: 2 | 4 | 8; sym?: 'common' | 'cut'; grouping?: number[] }
  // v1 closed set (zod enum on (count, unit)): 2/4 3/4 4/4 5/4 2/2 3/8 6/8 9/8 12/8 5/8 7/8;
  // grouping required iff (count, unit) ∈ {(5,8), (7,8)}, else forbidden; entries ∈ {2,3} summing to count;
  // sym 'common' only with 4/4, 'cut' only with 2/2
interface Tempo   { bpm: number; unit: Duration; text?: string }   // bpm integer 20..300; text is the display word ("Andante")

interface Measure {
  id: ElementId;
  pickup?: true;                  // anacrusis; measures[0] only; MEI metcon="false"
  complement?: true;              // the last measure only, legal iff measures[0].pickup; sums to meter − pickup length; MEI metcon="false"
  systemBreak?: true;             // a forced system break BEFORE this measure; MEI <sb/>; never on measures[0]
  keySig?: KeySig; timeSig?: TimeSig; tempo?: Tempo;      // a CHANGE taking effect at this measure; never on measures[0]
  staves: MeasureStaff[];         // index-aligned with doc.staves, exactly staves.length entries
  spanners: Spanner[];            // slurs and hairpins that START in this measure
  directions: Direction[];        // dynamics attached to an event in this measure
}

interface MeasureStaff { voices: Voice[] }                // 1..2 entries, distinct n, sorted by n
interface Voice { id: ElementId; n: 1 | 2; events: Event[] }   // n = MEI layer @n; ≥ 1 event

type Event = Note | Chord | Rest | MeasureRest | TupletGroup;   // zod discriminatedUnion('kind', …)

type DurBase = 1 | 2 | 4 | 8 | 16 | 32;                   // MEI @dur
interface Duration { base: DurBase; dots: 0 | 1 | 2 }

interface SpelledPitch {
  step: 'A'|'B'|'C'|'D'|'E'|'F'|'G'; alter: -2|-1|0|1|2;
  octave: number;                 // integer 0..8, scientific: C4 = middle C = MIDI 60 (identical to MEI @oct)
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
  notes: ChordNote[];             // ≥ 2, strictly ascending by midiOf(pitch) — an enharmonic pair is a zod error
  articulations?: Articulation[];
}
interface Rest        { kind: 'rest'; id: ElementId; duration: Duration }
interface MeasureRest { kind: 'measureRest'; id: ElementId }   // MEI <mRest/>; the only event in its voice; never in a pickup or complement
interface TupletGroup {
  kind: 'tuplet'; id: ElementId;
  num: number; numbase: number;   // MEI @num/@numbase: num in the time of numbase, e.g. 3:2; integers ≥ 1, num ≠ numbase
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
  `uuid5(SOUNDINGS_NS, 'soundings:score:' + canonicalJson(meta.recipe))`,
  with `SOUNDINGS_NS` the single fixed namespace the sight-reading doc
  defines (exported from `app/src/lib/ids.ts`, mirrored in
  `backend/app/ids.py`) — so regenerating a recipe is idempotent against
  `scores` and `exercises`. `Target.id` carries this UUID bare; the subject
  string (§Persistence) is the same UUID prefixed `score:`.
- **Element ids are NCName-safe, kind-prefixed strings** minted through an
  injected `IdSource`, never by the model itself:

  ```ts
  interface IdSource { next(kind: ElementKind): ElementId }
  export function seededIdSource(rng: () => number): IdSource;   // generator: deterministic per recipe
  export function randomIdSource(): IdSource;                    // editor, importer: crypto.getRandomValues
  ```

  Prefixes: `m` measure, `v` voice, `n` note and chord note, `c` chord,
  `r` rest, `mr` measure rest, `t` tuplet, `sl` slur, `hp` hairpin, `dy`
  dynamic, `sd` staff def. A stored id is exactly a prefix plus ten
  characters of `[0-9a-z]`; the `-suffix` form is reserved for derived ids
  (below) and is a zod error on a stored id, so a minted id can never
  collide with a derived one. Ids are unique across the whole document (all
  kinds pooled), never reused within it, never derived from position, and
  belong to their element for life (undo restores the same ids). Why not
  ULIDs or UUIDs: a ULID embeds a clock, which the generator's "no clock,
  same recipe same notes" rule forbids; both usually start with a digit,
  which `xml:id` (an NCName) forbids — Verovio passes digit-leading ids
  through unharmed (verified `exp04`), so the rule is about schema-valid
  MEI, interchange, and `#id` CSS selectors, not rendering. Resolvers use
  `[id="…"]` attribute selectors regardless.
- **Derived elements get derived ids** — the one explicit exception to
  "never derived from position": every element the serializer *creates*
  gets an id computed from its owner. Beam → `${firstMember.id}-beam`;
  tie → `${startNote.id}-tie`; note articulation *i* → `${note.id}-a${i}`;
  chord articulation *i* → `${chord.id}-a${i}`; fingering →
  `${note.id}-fing`; cautionary accidental child → `${note.id}-acc`; staff
  → `${measure.id}-s${n}`; system break → `${measure.id}-sb`; tempo mark →
  `${measure.id}-tempo`; a change `<scoreDef>` → `${measure.id}-sdef`;
  document-level `<section>`, `<staffGrp>`, `<scoreDef>`, `<mdiv>`,
  `<score>` → `sec`, `sg`, `sdef`, `mdiv`, `score` (fixed, one each).
  Without this Verovio mints random ids for these groups on every render
  (`exp01`, `exp11`) and the emitted MEI is non-deterministic. SVG
  determinism itself comes from `xmlIdSeed` (§Rules), which also covers the
  stem, flag, dot, accidental, clef/keySig/meterSig, barline and system
  groups that no model element owns.
- **Copies re-mint.** `cloneScoreDoc(doc, ids: IdSource): { doc; idMap:
  Map<ElementId, ElementId> }` mints a new document UUID and re-mints every
  element id, remapping spanner endpoints and direction targets, and sets
  `meta.derivedFrom`; the map lets a caller carry annotations across
  deliberately. Uniqueness is per document; anchors are always scoped by
  their target.

### Rules that matter more than the field list

- **Pitch is absolute; the serializer owns the written/gestural split.**
  `alter` is the sounding alteration with the key signature already applied
  (ScoreDoc spells every note). `toMei()` **always** emits `accid.ges`
  when `alter ≠ 0` — Verovio does not apply the key signature or bar
  carry-over to sounding pitch: an unmarked F in G major sounds as F♮, and
  a plain C after a C♯ in the same bar sounds as C♮ (verified 4.5.1,
  `exp12`, `exp18`). Value tables — written `@accid`: −2 `ff`, −1 `f`, 0
  `n`, +1 `s`, +2 `x`; gestural `@accid.ges`: −2 `ff`, −1 `f`, +1 `s`, +2
  `ss` — never `x`, which 4.5.1 rejects for `accid.ges` and sounds the note
  unaltered (`exp22` C). **`accidentalState()`** decides what is printed: it
  walks each staff's events of a measure in score-time order (both voices
  merged by onset; a chord's notes together), keeping per (letter, octave)
  the alteration in force — initially the key signature's alteration for
  that letter, replaced by each written accidental. A note prints an
  accidental (a natural when `alter === 0`) iff its `alter` differs from
  the alteration in force, after which its `alter` is the one in force. A
  tie-stop note prints nothing and changes nothing; across a barline the
  tie-start's `alter` stays in force for that (letter, octave) until the
  chain ends. `courtesy: true` forces a cautionary accidental and is a zod
  error (`courtesy-redundant`) on a note that would print one anyway; it is
  emitted as a child `<accid xml:id="${note.id}-acc" accid="…"
  accid.ges="…" func="caution" enclose="paren"/>` with **no** accidental
  attributes on the `<note>` itself — `func="caution"` alone draws no
  parentheses, `enclose="paren"` does, and a note carrying `@accid.ges`
  beside an `<accid>` child makes Verovio warn and mint a second accid
  group (`exp22` B). The scorer imports the same `accidentalState()` so it
  never disagrees with the engraving, and it never counts cautionary
  accidentals.
- **Durations are rational, never floats, in quarter-note units
  throughout.** `durationOf(d, tuplet?) = (4/base) × (2 − 2^−dots) ×
  (numbase/num)`; refinement 2 compares a voice's sum against `count ×
  4/unit`. Measures are full: every voice sums exactly to the meter in
  effect; a `pickup` measure sums to strictly less, its `complement` to
  `meter − pickup`. Verovio enforces none of this — an overfull bar renders
  and silently shifts every later onset (`exp19`) — so it is the schema's
  job (§Validity). Verovio's timemap reports tuplet positions as IEEE
  floats and rounds `tstamp` to integer ms (`exp02`); it is joined by id,
  never compared against model positions.
- **Ties pair by rule, not by reference.** A note or chord note with
  `tie: 'start' | 'both'` pairs with the *immediately following* event in
  the same staff and `Voice.n` — the next member of its tuplet, the event
  after the tuplet, or the first event of that voice in the next measure
  (crossing at most one barline). That event must be a Note, or a Chord
  containing a note, of identical spelled pitch carrying `'stop' | 'both'`;
  a rest, a different pitch or a missing voice is a zod error
  (`tie-dangling`), and every `'stop' | 'both'` must be reached by such a
  start (`tie-orphan-stop`). The serializer emits the element form
  `<tie xml:id startid endid>` in the start measure: attribute-form ties get
  a random id (`exp11`) and are dropped across layers with a console
  warning, while the element form renders across layers without complaint
  (`exp22` G) — so the same-`Voice.n` rule is enforced only by zod.
  **A tied chain is one sounding event**, identified by the tie-start id:
  Verovio's timemap lists every tie-stop note as a fresh onset while its own
  MIDI export merges the chain (`exp11`), so the expected-onset grid is
  never taken from the timemap.
- **Voice identity across measures is `Voice.n`**, the MEI layer number;
  `Voice.id` identifies this voice-in-this-measure (selectable; never an
  anchor). A staff may carry only `n: 2` in a measure; when both voices are
  present the serializer sets `stem.dir` up/down by `n`. Two voices per
  staff is a v1 limit.
- **Initial state lives on the document, changes on the measure.**
  `doc.keySig/timeSig/tempo` go into the initial `<scoreDef>`; a measure
  carrying a change gets a `<scoreDef xml:id="${measure.id}-sdef">` before
  it (key/meter, repeating only the changed attributes) or a `<tempo>`
  inside it; `measures[0]` never carries any of the three (refinement 8) —
  two tempo marks in one bar both render and the last wins for timing.
  Effective state at a measure is the last explicit value at or before it
  (`effectiveAttrs(doc, measureId)`). Verovio silently assumes 120 bpm when
  no tempo is encoded (`exp17`), which is why tempo is required. **MEI
  form** (the one `docs/probes/verovio/lib.mjs` proves): `<mei
  meiversion="5.0">`; `<scoreDef xml:id="sdef" midi.bpm keysig="{n}s|{n}f|0"
  key.mode meter.count meter.unit meter.sym?><staffGrp xml:id="sg"
  symbol="brace" bar.thru="true"><staffDef xml:id={StaffDef.id} n lines="5"
  clef.shape="G|F" clef.line="2|4"/>…`.
- **Tempo is normalized to quarter-note terms by the serializer.**
  `quarterBpm = bpm × quarterLength(unit)`; `toMei()` writes
  `<tempo xml:id="${measure.id}-tempo" staff="1" tstamp="1"
  midi.bpm="{quarterBpm}" mm="{bpm}" mm.unit="{base}" mm.dots="{dots}">
  {text} <rend fontfam="smufl">{glyph}</rend> = {bpm}</tempo>` plus
  `scoreDef@midi.bpm` for the first measure, where `{glyph}` is the SMuFL
  metronome note for `unit` (U+ECA2 whole, U+ECA3 half, U+ECA5 quarter,
  U+ECA7 eighth, U+ECA9 sixteenth, plus U+ECB7 per dot). `midi.bpm` on the
  element is what Verovio times by and overrides `mm.*` and
  `scoreDef@midi.bpm` (`exp22` E); without it Verovio times by `mm` /
  `mm.unit` — correctly for units 2, 4, 8 but as 4/3 for a dotted unit
  (♩. = 60 runs at 80 qpm, not 90; `exp17`) — so `mm.*` is never emitted
  without `midi.bpm`. The visible mark is text the serializer composes:
  an attribute-only `<tempo>` draws nothing (`exp22` E). Verovio applies
  a mid-measure tempo change from the bar start (`exp02`), so one tempo
  mark per measure at beat 1 is the model. The beat unit the metronome
  clicks is `beatUnit(timeSig)`: a dotted `(unit/2)`-note when `unit ≥ 8
  && count % 3 === 0`, else the `unit`-note — the rule `lib/time.ts
  beatsPerBar` already encodes; `TimeSig.grouping` (e.g. `[2,3]` for 5/8)
  drives beaming and the accent pattern.
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
  and 7/8 by `grouping`): events are assigned to a beat group by onset; two
  or more consecutive events shorter than a quarter in one beat group form
  a `<beam>`; a rest, a quarter-or-longer, or a beat-group boundary breaks
  it; a lone eighth stays flagged (a one-member `<beam>` renders as a stub
  with no flag, `exp22` I). Inside a tuplet the tuplet is the outer
  container and beams form inside it (both nestings render and time
  correctly, `exp09`). Beam ids are derived, never stored, and never legal
  anchors. Manual overrides are E3.
- **Canonical JSON and content hash.** `canonicalJson(doc)` is RFC 8785
  (JCS) — sorted keys, no whitespace, `undefined` omitted — synchronous, in
  TS (`app/src/lib/canonical-json.ts`); `scoreDocHash(doc): Promise<string>`
  is `crypto.subtle.digest('SHA-256', canonicalJson(doc without revision))`
  (browsers and Node ≥ 20; no new dependency). Every provenance run that
  consumes a score names `scoreDocHash` in `input_sha256s` and references
  `{ scoreId, scoreDocHash }` in `params` — never the document body. The
  backend stores the client-computed hash and never recomputes it (Python
  never re-derives what TS owns).
- **Cardinalities** (all zod, each with a negative snapshot test):
  `staves.length === 2`, `measures.length ≥ 1`, `measure.staves.length ===
  staves.length`, `1 ≤ voices.length ≤ 2` with distinct `n`,
  `events.length ≥ 1` (a silent voice holds one `MeasureRest`, or explicit
  rests in a pickup or complement), `chord.notes.length ≥ 2`,
  `tuplet.events.length ≥ 2`.

### Score-time and the timeline

The doc's consumers need one definition of *when* an event happens. Score
time is quarter-note units as an exact `Fraction` from the start of the
score — the same unit as Verovio's `qstamp`, without its floats. Every
`Fraction` in `TimelineEvent` and `SoundingEvent` (`onset`, `beat`,
`duration`, `tiedDuration`) is in quarter-note units.

```ts
interface TimelineEvent {          // one per Note, ChordNote, Rest, MeasureRest
  id: ElementId; measureId: ElementId; measureIndex: number;
  staffIndex: 0 | 1; hand: 'rh' | 'lh'; voiceN: 1 | 2;
  onset: Fraction;                 // absolute
  beat: Fraction;                  // 0-based offset from the measure's notated start (a pickup's first event has beat 0;
                                   // consumers right-align a pickup with meter − pickupLength + beat)
  duration: Fraction;              // notated; a MeasureRest's duration is the effective meter
  sounding: boolean;               // false for rests and tie-stop notes
}
interface SoundingEvent {          // tie-merged, chord-collapsed, rest-free; the assessment grid
  id: ElementId;                   // the Note or Chord whose non-tie-stop noteheads start here
  onset: Fraction; staffIndex: 0 | 1; hand: 'rh' | 'lh'; voiceN: 1 | 2;
  pitches: Array<{ noteId: ElementId; midi: number; tiedNoteIds: ElementId[]; tiedDuration: Fraction }>;
    // only noteheads that are not tie-stops; a chord tied in on some notes contributes just its new pitches;
    // a chord all of whose notes are tie-stops yields no event; tiedDuration is per pitch because one chord's chains may differ
}
export function timeline(doc: ScoreDoc): TimelineEvent[];        // app/src/score/timeline.ts
export function soundingEvents(doc: ScoreDoc): SoundingEvent[];
export function msAt(t: Fraction, quarterBpm: number): number;   // t × 60000 / quarterBpm — single-tempo spans (generated exercises)
export function tempoMap(doc: ScoreDoc): Array<{ from: Fraction; quarterBpm: number }>;
export function msAtMap(t: Fraction, map: ReturnType<typeof tempoMap>): number;   // integrates segment by segment for Measure.tempo changes
export function midiOf(p: SpelledPitch): number;                  // 12 × (octave + 1) + pc(step) + alter
```

A measure's onset is the sum of `count × 4/unit` of every preceding
measure's effective meter (a pickup or complement contributes its actual
length); a voice's onsets accumulate rational durations, tuplets scaling
their members by `numbase/num`. **`timeline()` / `soundingEvents()` are the
only source of expected onsets** — for MIDI assessment, for the generator's
verify pass, for score↔recording alignment, and for the `scoreTime`
anchor. The Verovio timemap is consumed only by the CursorLayer, only for
note ids, `<rest>` ids and `measureOn`, and only for the render it came
with; a fixture test asserts `timeline()` onsets equal Verovio `qstamp`
within 1e-6 for every note so the two views are proven consistent.
`<mRest>` ids never appear in the timemap even with `includeRests`
(`exp02`, `exp22` K) — a MeasureRest is located only through its measure's
`measureOn` — and Verovio omits grace notes entirely (`exp02`), so any
future ornament event kind ships with its own timing clause here.

### Validity

Verovio validates nothing: overfull and underfull voices, a missing staff, a
note with no duration, a tuplet without a ratio, duplicate `xml:id`s, a
bad pitch name and an unknown element all load with `loadData → 1` and an
empty `getLog()` (`exp19`, `exp08`; every warning goes to the console and is
not visible through `getLog()` — 4.5.1's JS toolkit has no log-level API,
and capturing it would mean overriding `printErr` on the module factory,
which the app does not do). The schema is therefore the only gate.

```ts
interface Issue { code: IssueCode; path: (string | number)[]; message: string; ids?: ElementId[] }
type IssueCode =
  | 'schema' | 'id-pattern' | 'id-duplicate'
  | 'voice-overfull' | 'voice-underfull' | 'pickup-not-short' | 'pickup-mrest' | 'complement-length'
  | 'staff-count' | 'voice-n' | 'mrest-not-alone' | 'chord-size' | 'chord-duplicate-pitch' | 'tuplet-ratio'
  | 'tie-dangling' | 'tie-orphan-stop' | 'endpoint-unresolved' | 'spanner-order' | 'spanner-measure'
  | 'courtesy-redundant' | 'range' | 'pickup-position' | 'complement-position' | 'systembreak-position'
  | 'initial-state-on-measure' | 'timesig-set' | 'timesig-grouping' | 'timesig-sym';
```

`ScoreDocSchema` (structural zod) and `validateScoreDoc(doc: unknown):
Issue[]` live in `app/src/score/schema.ts`; `validateScoreDoc` runs
`ScoreDocSchema.safeParse` first (every structural failure becomes one
`code: 'schema'` issue carrying the zod path — this covers a nested tuplet,
a one-note chord, a wrong staff count and a digit-leading id) and the
semantic refinements only on a structurally valid document.
`renderScoreDoc` throws on any issue and treats `loadData === false` as an
internal error, never as validation. Refinements, all mandatory in v1:

1. Every id is unique across the document (`id-duplicate`) and matches the
   stored-id pattern exactly (`id-pattern`).
2. Per measure, per voice, durations (with tuplet ratios) sum exactly to the
   effective meter (`voice-overfull` / `voice-underfull`); a `pickup`
   measure sums to the same value strictly less than the meter in every
   voice (`pickup-not-short`); a `complement` measure sums exactly to
   `meter − pickupLength` (`complement-length`). A `MeasureRest` is illegal
   in a pickup or complement (`pickup-mrest`): Verovio times `<mRest>` as
   the full meter even under `metcon="false"` (`exp22` H — RH quarter + LH
   `<mRest>` puts measure 1 at qstamp 4; with `<rest dur="4"/>`, at qstamp
   1), so those measures carry explicit rests.
3. `measures[i].staves` has exactly `staves.length` entries (`staff-count`);
   voices have distinct ascending `n` (`voice-n`); a `MeasureRest` is alone
   in its voice (`mrest-not-alone`).
4. Chord notes are strictly ascending by `midiOf` (`chord-duplicate-pitch`
   for an enharmonic pair); chord notes carry no duration.
5. A tuplet's nominal member durations sum to `num × u` for some power-of-two
   `u` — i.e. `sum / num` reduces to `1 / 2^k` (`tuplet-ratio`); the tuplet
   then occupies `numbase × u` of score time (♪ ♬ ♪ under 3:2 is legal and
   times correctly).
6. Tie pairing per the rule above (`tie-dangling`, `tie-orphan-stop`);
   spanner `startId`/`endId` and direction `at` resolve to a Note, ChordNote
   or Chord (`endpoint-unresolved`; rests are not endpoints); a slur or
   hairpin starts strictly before it ends (`spanner-order`; 4.5.1 draws
   nothing useful for `startid === endid`); a spanner lives in the measure
   of its start element (`spanner-measure`).
7. `courtesy` only on notes that would otherwise print no accidental
   (`courtesy-redundant`); `octave` is an integer 0..8 and `midiOf(pitch)`
   within 21..108 (`range`); `pickup` only on `measures[0]`
   (`pickup-position`); `complement` only on the last measure and only when
   `measures[0].pickup` (`complement-position`); `systemBreak` never on
   `measures[0]` (`systembreak-position`); `TimeSig` in the closed set
   (`timesig-set`) with `grouping` and `sym` per the type comments
   (`timesig-grouping`, `timesig-sym`).
8. `measures[0]` never carries `keySig`, `timeSig` or `tempo` — the
   document fields are the initial state (`initial-state-on-measure`).

The generator's verify step runs `validateScoreDoc` before the scorer; the
importer runs it as the promotion gate; every editor command runs it on the
post-state and is rejected on any issue.

## Rendering pipeline

```
native:   ScoreDoc ──toMei()──▶ MEI ──renderScoreDoc()──▶ SVG + timemap + MEI
                                        (toolkit.ts: new entry)
foreign:  MusicXML / MEI / ABC ─────────renderToSvg()───────▶ SVG   (+ xmlIdChecksum, measure@n)
legacy:   ABC (drills, thumbnails) ─────renderToSvg()───────▶ SVG   (behaviourally unchanged)
```

`app/src/verovio/toolkit.ts` already supports `inputFrom: 'mei'`
(verified: `inputFrom` is the 4.5.1 option name; the old `from` is not,
`exp21`). It gains one entry, `renderScoreDoc(doc, { widthPx, measureIds? }):
Promise<{ svg: string; timemap: TimemapEntry[]; mei: string }>` —
`TimemapEntry` gains `measureOn?: string; restsOn?: string[]; restsOff?:
string[]` — with these rules, each backed by a probe:

- **Reset before set.** The toolkit is shared and `setOptions` merges
  without resetting — a `pageWidth` or `svgHtml5` set by one caller
  persists into the next DEFAULTS-shaped call (`exp21`). Every render calls
  `tk.resetOptions()` first; the ABC helpers are updated to do the same
  (their behaviour is otherwise unchanged).
- **Never `svgHtml5`.** It replaces every `id=` with `data-id=` and breaks
  every `[id="…"]` lookup (`exp14b`).
- **One page, wrapped systems.** `breaks: 'encoded'` honours the
  ScoreDoc's `systemBreak` marks (`<sb/>` before the measure; the generator
  sets one every four bars so phrases are lines) and, when a document
  carries none, falls back to automatic wrapping with a console warning
  (`exp22` F) — so authored scores without marks still wrap. `pageWidth =
  widthPx × 100 / scale`, `pageHeight: 60000` (Verovio's maximum, `exp21`)
  and `adjustPageHeight: true` so the whole score is one page;
  `renderScoreDoc` asserts `getPageCount() === 1` and throws otherwise.
  Under the thumbnail defaults a 32-bar exercise is one 4975 px-wide
  system, and with a bounded page `renderToSVG(1)` silently omits every
  element on later pages (`exp13b`, `exp21`) — anchors, cursor and
  hit-testing would all fail for the second half. Pagination is a non-goal
  until a page-scale need arrives; at that point the resolver walks pages
  via `getPageWithElement`.
- **Determinism.** `xmlIdSeed: 1` in the options set before every load
  (§Rules); foreign renders use `xmlIdChecksum: true` instead.
- **Timemap with rests.** `renderToTimemap({ includeMeasures: true,
  includeRests: true })` so `<rest>` ids are addressable in time (`restsOn`
  / `restsOff`); `<mRest>` ids never appear (`exp22` K) and the cursor never
  looks a `mr` id up in the timemap.
- **Windowed re-render** (the escape hatch for page-scale scores) maps
  `measureIds: { start, end }` onto `tk.select({ start, end })` followed by
  `redoLayout()`, which 4.5.1 honours for measure ids only: a note id or an
  unknown start logs a console warning, `select()` still returns 1, and the
  whole score renders; an unresolvable `end` silently extends the window to
  the last measure (`exp22` D). `renderScoreDoc` therefore verifies every
  window by asserting the rendered `g.measure` ids equal the requested range
  and throws otherwise. The positional `measureRange: "a-b"` string stays
  for legacy ABC only: Verovio interprets it as 1-based document position,
  not `@n`, and a range it cannot find is rejected with a console-only
  warning and the whole score rendered (`exp20`). Under a window the
  selected elements keep their ids and unselected ids report "not found"
  (`exp06`); the windowed timemap is **window-relative** — its first entry
  is `tstamp 0` — unless a full-document timemap was already computed on
  the same `loadData`, in which case Verovio reuses those absolute times
  (`exp22` A; `exp06` happened to do this and reported 8000 ms). The
  CursorLayer never relies on Verovio for the offset: it adds
  `msAt(onsetOf(window.start), quarterBpm)` from `timeline()` to every
  windowed `tstamp`, and the resolver distinguishes *unrendered* (in the
  doc, not on screen) from *orphaned*.
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
working; they migrate to ScoreDoc opportunistically, not as a project. The
sargam substrate explicitly stays its own renderer per
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
interface Target { kind: TargetKind; id: string }    // score → scores.id bare (native or foreign); piece → bundled PIECES[].id slug; recording → recordings.id

type Body =
  | { kind: 'text'; text: string }
  | { kind: 'highlight'; color: 'coral' | 'krill' | 'lumen' | 'ink' }          // theme tokens, never hex
  | { kind: 'symbol'; symbol: 'circle' | 'check' | 'cross' | 'star' | 'breath' | 'pedal'; label?: string }
  | { kind: 'ink'; strokes: Array<{ points: Array<[x: number, y: number, p?: number]> }>; width?: number }  // region-frame space
  | { kind: 'verdict'; verdict: 'correct' | 'corrected' | 'wrong-pitch' | 'wrong-octave' | 'missed' | 'extra';
      timing?: 'on-time' | 'early' | 'late' | 'n/a'; expectedMidi?: number; playedMidi?: number;
      onsetDeltaMs?: number; cascade?: boolean; inResync?: string }
  | { kind: 'hesitation'; hesitation: 'stumble' | 'stall' | 'skip'; shiftMs: number; beatsSkipped?: number }
  | { kind: 'tempo'; ratio: number; label?: string }                            // local ÷ target over the anchored span (recordings)
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
  an existing anchor. `measureIndex` means 1-based document order of
  `g.measure` in the *full* render — never the encoded `@n` (MusicXML
  pickups are `0`, ABC has none) and never a partial render (`heatmap.ts`
  indexes the currently rendered list, which is off by the window start
  after a `select`; `exp06`). The resolver keeps an `index → id` map from
  the full render.
- **Compatibility is by tier, resolved from `scores.kind`** (`piece` is
  always foreign-tier). Anchor × tier: `elements` on native; on `piece` and
  foreign `score` only with `render`. `span`, `measures`, `scoreTime` on
  native only. `measureIndex` on `piece` and foreign `score`. `region` with
  frame `measure` on native, `measureIndex` on foreign staff scores, `page`
  on PDF/image artifacts. `timeRange` on `recording` only. Body × anchor:
  `text` anywhere; `highlight` on elements/span/measures/measureIndex/
  scoreTime/timeRange; `symbol` on a single element or a region; `ink` on
  region only; `verdict` on exactly one notehead (or `scoreTime` for
  `extra`); `hesitation` on scoreTime only; `tempo` on scoreTime/timeRange;
  `heat` on measures/measureIndex/timeRange. The zod schema encodes both
  tables against the loaded score's `kind`; the API loads `scores.kind` for
  the target and returns 422.
- **`scoreTime` is the anchor for things with no element**: an `extra`
  played note, a hesitation span, a projected audio range. Geometry: the x
  of the last timeline event at or before `from` and of the next event in
  that measure's SVG group, interpolated; y from the staff box (or the
  system when `staffIndex` is absent). Only legal on native `score`
  targets. The recordings doc's alignment bridge projects `timeRange ↔
  scoreTime`; "no schema changes" there is true because this kind exists
  from day one.
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
  from: Fraction; to: Fraction; staffIndexes?; voiceN? }` (half-open, in
  score time from `timeline()`); `resolveSelection(doc, sel)` yields ids.
  Render order is layers by `position`, then annotations by `createdAt`;
  overlays never intercept clicks except annotation groups of the active
  layer in `select` mode.
- **CursorLayer**: consumes the timemap by id (`on`/`off`/`restsOn`/
  `measureOn`); treats an `on` for a tie-stop note as continuation
  (highlight moves, no onset flash) and lights a chord by lighting its
  notes; takes `encodedBpm` from the ScoreDoc's tempo, scaled by an
  optional `rate` (attempt bpm ÷ encoded bpm, supplied by the sight-reading
  player) — never from `subject.bpmTarget`; offsets its clock by the
  window's first-measure onset from `timeline()` under a window, never by
  a Verovio `tstamp`; advances through bars of rests because silent
  measures still produce a `measureOn` entry (`exp17`).
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
  | { type: 'setDocAttrs'; keySig?: KeySig; timeSig?: TimeSig; tempo?: Tempo }   // the initial state
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
`spellMidi(midi, keySig, prefer: 'sharp' | 'flat')` (if `midi` is diatonic
in `keySig` return the diatonic spelling; otherwise spell it as the nearest
diatonic letter below raised by one for `'sharp'` or the nearest above
lowered by one for `'flat'`; never a double accidental — callers wanting one
construct the `SpelledPitch` themselves) and `transposePitch(pitch,
semitones, keySig)` (moves by semitones and re-spells with `spellMidi`
using `'sharp'` for upward and `'flat'` for downward moves, unless the
interval is diatonic in the key, in which case the letter moves by the
diatonic step count); step entry, the MIDI→ScoreDoc importer, the
generator's legality pass and the `transpose` batch all call them;
(9) **generated exercises are immutable** — opening one in the editor forks
it into a new `scores` row (`meta.source: 'authored'`, `meta.derivedFrom`
set, element ids preserved so verdicts on the exercise stay on the
exercise).

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
  generated exercise is a `scores` row plus `exercises.score_id`, written
  together by `POST /v1/exercises` in one transaction with
  `exercises.id === scores.id === uuid5(recipe)` (the recipe and feature
  vector stay on `exercises`); an idea's native harmony or melody
  attachment, when that later feature lands, is likewise a `scores` row
  referenced from the idea — not a JSONB column on `idea_assets`, which
  stays a bytes table for non-substrate files. `Annotation.target.kind ===
  'score'` always names a `scores.id`. Derived MEI and SVG are never stored
  (persist the source, derive the rest); if a server-side consumer ever
  needs MEI it lands as a derived asset with a `run_id`.
- **Scores are subjects.** `SubjectKind` gains `'score'`; the subject id is
  the string `score:<uuid>` (SB4's `idea:<uuid>` convention). Recordings,
  practice sessions, collections and extraction runs address a score
  through that string — so `extraction_runs.subject_id` is `str`, not
  `uuid` (amends PV1; RC1 already says `str`). The house subject form is:
  `kind:<uuid>` for uuid-backed kinds (idea, score, exercise, recording),
  the bare bundled id for `piece` and `scale` — exactly what
  `practice_sessions.subject_id` already stores.
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
  test like `ChordIdentity`; the server enforces the anchor × tier table.
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

  Layers and annotations are reachable only through a live target: `score`
  and `recording` rows must exist and be undeleted (404 otherwise); `piece`
  targets are accepted for any slug (bundled data is client-side) and never
  404. No cascade write on target delete, so restoring a target restores
  its marks. `annotations.target_kind/target_id` are denormalised from the
  layer on create and read-only on the wire.
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
  seed, draw a tempo from attributes alone — is the app's job, and is
  written down above with the probe that proved it.
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
  repeats and endings, multi-measure rests, meters outside the closed set**
  — outside the native subset; imported scores using them stay foreign.
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
| ScoreDoc schema + zod + validity + `toMei()` + `timeline()` + `renderScoreDoc` + `cloneScoreDoc` + snapshot tests (MEI and SVG) | pattern-setter; the contract everything consumes | T3 |
| ScoreSurface stack (engraving/annotation/interaction/cursor layers) | refactor Score.tsx/heatmap.ts/SessionScore.tsx into the stack; hit-testing and selection per this doc | T2 |
| Anchor resolution + overlay renderer | every anchor kind → geometry, status enum, spanning-element union, virtual-layer projection | T2 |
| Scores + layers + annotations persistence (tables, versioned PUT, API, migration) | not "standard CRUD": polymorphic target, tier-resolved anchor check, version check, contract ownership | T2 |
| Foreign score import + content streaming | `scores` kind foreign over `MediaStoreDep` | T1 |
| Section heatmap → virtual system layer | mechanical once projection exists | T0 |
| MusicXML→ScoreDoc importer (native subset), promotion path | new native row, lineage, annotation copy rules | T2 |
| E1 structured entry (cursor, palette, MIDI step-entry, `pitch.ts`) | first editor stage | T2 |

## F1 review — what changed and why (2026-09-02)

Every item below was found by the adversarial pass or the critic pass and
either verified against Verovio 4.5.1 (probe named) or traced to a
contradiction with a companion doc or the backend conventions. The
corresponding text above is already amended; this list exists so the
ratifying reader can check the reasoning without diffing.

1. **Ids.** ULIDs dropped: they embed a clock (breaks "same recipe, same
   notes") and are not NCNames. `ScoreDoc.id` = the row UUID; element ids
   are prefixed, injected-source strings with an exact stored pattern;
   derived elements get derived ids from one complete list; one
   `SOUNDINGS_NS`. (`exp04`, `exp01`, `exp11`; the UUID `PKMixin` in
   `backend/app/models/base.py`.)
2. **Pitch.** `accid.ges` is mandatory for every altered note — Verovio
   does not apply the key signature to sounding pitch (`exp12`, `exp18`);
   the gestural vocabulary is `s|ss|f|ff`, never `x` (`exp22` C).
   `accidentalState()` is an algorithm, not a phrase; cautionary
   accidentals are a child `<accid enclose="paren">` (`exp22` B).
3. **Ties.** Timemap lists tie-stops as onsets; MIDI merges them (`exp11`).
   Expected onsets come from `soundingEvents()`, never the timemap; pairing
   is with the immediately following event; the element form renders across
   layers so zod is the only guard (`exp22` G).
4. **Timemap coverage.** Only note ids are time-addressable; chord, tuplet,
   measure-rest, grace and tempo ids never appear; `getTimeForElement`
   returns 0 for both "not found" and "is a rest" (`exp02`, `exp03`,
   `exp22` K). Hence §Score-time, in quarter-note units throughout, with
   per-pitch tied durations and a tempo map.
5. **Validation.** Verovio swallows overfull bars, missing staves, missing
   durations, duplicate ids and unknown elements silently (`exp19`,
   `exp08`); an `mRest` in a pickup is timed as a full bar (`exp22` H).
   Hence §Validity with a typed `Issue` and codes.
6. **Beaming** is not automatic for MEI input (`exp09`) — the serializer's
   beam table is load-bearing; a one-member beam is a stub (`exp22` I).
7. **Tempo.** Dotted `mm.unit` is computed as 4/3; `midi.bpm` on the element
   wins over `mm.*` and `scoreDef`; an attribute-only `<tempo>` draws no
   text; mid-measure changes snap to the bar; no tempo means 120 (`exp17`,
   `exp22` E). Tempo is required, normalized, and composed as visible text.
8. **Determinism.** SVG differs on every load unless `xmlIdSeed` is re-set
   before each `loadData` or `xmlIdChecksum` is on (`exp20`, `exp21`);
   foreign ids are random per load by default (`exp05`).
9. **Toolkit state.** `setOptions` merges and persists across callers;
   `svgHtml5` deletes every id; `inputFrom` is the option name (`exp21`,
   `exp14b`).
10. **Layout and windows.** Thumbnail defaults make a 32-bar score one
    5000 px system; a bounded page silently drops later measures from page
    1 (`exp13b`, `exp21`); spanning slurs/ties get id-less continuation
    groups (`exp13c`); `breaks: 'encoded'` falls back to auto wrapping
    without `<sb/>` (`exp22` F); `select({start,end})` honours measure ids
    only and never signals failure through its return value (`exp22` D); a
    select-first windowed timemap is window-relative (`exp22` A), so the
    cursor offset comes from `timeline()`.
11. **Hit-testing.** `closest('[id]')` returns random Verovio ids for every
    non-notehead glyph of a note and for ledger lines, barlines, clefs and
    signatures (`exp10`).
12. **Region anchors.** The measure bbox drifts with unrelated content
    (`exp16`); regions are now staff-relative.
13. **Measure numbering.** Verovio's `measureRange` is positional and
    renders everything on a miss (`exp20`); native anchors use measure ids,
    foreign anchors use full-render document order.
14. **Model gaps closed:** Chord/ChordNote (verdicts need notehead ids),
    Rest/MeasureRest, TupletGroup with a ratio rule, StaffDef with `hand`,
    KeySig `mode`, a closed TimeSig set with `grouping`, Tempo unit and
    text, `Voice.n`, spanners and dynamics at measure level (`exp01`),
    `courtesy`, `pickup` and `complement`, `systemBreak`, `revision`, closed
    `meta` carrying the sight-reading `Recipe` verbatim, event `kind`
    discriminants, cardinalities, `Fraction`/`ElementKind`/`Issue` types.
15. **Anchor contract:** `span`, `measures`, `measureIndex`, `scoreTime`,
    region frames, `timeRange` clock and `offset_ms`, foreign render key;
    substrate tag moved to the target; bodies defined including `verdict`
    (with timing), `hesitation`, `tempo`, `heat`; compatibility by tier,
    resolved from `scores.kind`; orphan status enum; system marks are
    virtual projections (resolves supersession, the public build, and the
    double-home contradiction with the provenance doc).
16. **Persistence:** one `scores` table for both tiers (resolves the
    `scores` vs `exercises` vs idea-attachment three-homes contradiction);
    scores are subjects in the house string form; integer version;
    read-time blob migration; contract ownership split; API sketch with
    `piece` targets never 404; promotion as a new row; two annotation
    stores; `extraction_runs.subject_id` becomes `str` (PV1).
17. **Editing:** serializable commands with pure `apply`, cursor and
    overwrite semantics, id-stable undo, paste re-mints, a spelled-out
    `spellMidi`, generated exercises fork on edit, Verovio's editor API
    never used.
18. **Grooming consequences** (applied in the grooming doc): SC4 re-tiered
    to T2 and re-scoped to scores + layers + annotations; SC7 (foreign
    import) added; SC3 covers every anchor kind and the projection; SC6
    becomes a virtual layer; SR5 depends on SC1 not SC2; SR6 on SC3 not
    SC5; RC1 gains `offset_ms`; PV1 `subject_id` is `str` and accepts
    client-executed runs.
