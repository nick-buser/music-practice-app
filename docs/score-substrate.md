# The score substrate: representation, rendering, annotation, editing

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
model defined here).

## Why our own AST, not ABC, MEI, or MusicXML as the canonical model

| Candidate | What it's good at | Why it can't be canonical |
|---|---|---|
| **ABC strings** (status quo) | Compact, hand-writable, already emitted programmatically (`chord-identity.ts` `toAbc`, `data/scales/engraving.ts`) | No element identity — Verovio mints its own ids for ABC input, and we don't control them across renders. Editing means text surgery. Grand-staff piano writing strains ABC's voice model. Render-only format. |
| **Raw MEI** | Full CWMN expressivity; Verovio-native; we control `xml:id` | XML manipulation in TS is miserable; zod can't validate it; the full MEI schema is enormous; it would be the only XML-canonical model in a codebase whose house pattern is typed TS documents. An editor over raw MEI is an editor over a DOM, not over a domain model. |
| **MusicXML** | Universal interchange (MuseScore, OMR tools export it) | An interchange format, not a working model — even more verbose than MEI, and Verovio imports it by converting to MEI internally (no export back). Same XML pain. |
| **ScoreDoc — our own TS AST** ✅ | Typed, zod-validated, JSON-serializable (JSONB in Postgres), mutable by commands, minted ids on every element | We must write and maintain a serializer to MEI and grow the model deliberately. That cost is the price of the editor ambition, and it's the cost this codebase has paid twice before, successfully. |

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
`<g>` in the DOM, the timemap entry, the annotation anchor, and the MIDI
assessment verdict. That single property is what the whole substrate hangs
on — and it is why the native rendering path must be MEI, not ABC.

## Two tiers: native and foreign scores

We are not going to model all of Common Western Music Notation up front —
that's how notation projects die. Scores come in two tiers:

- **Native scores** are ScoreDoc-backed: editable, generatable, fully
  addressable. The v1 model scope is what generation, drills, and sketches
  actually need: grand staff (two staves, one part), up to two voices per
  staff, standard durations (whole through 32nd, dots, simple tuplets),
  ties, slurs, accidentals with correct spelling, key and time signatures,
  tempo marks, dynamics, articulations, fingering numbers.
- **Foreign scores** are imported artifacts — MusicXML or MEI files, ABC,
  eventually OMR output and plain PDF/photos. They render via Verovio
  directly (or display as images, for PDFs), and they are **annotatable but
  not editable**. Annotations on foreign scores use coarser anchors
  (measure ranges, render-level element ids) that are honest about their
  stability.

The **promotion path** keeps the editor ambition honest without boiling the
ocean: a MusicXML→ScoreDoc importer covering the native subset promotes a
foreign score to native when everything in it fits the model. Anything
outside the subset stays foreign until the model deliberately grows.
Generated exercises and hand-entered sketches are born native; the Chopin
you import from MuseScore starts foreign.

## ScoreDoc shape

Containment mirrors MEI (measure → staff → voice → events) so serialization
is a straight tree-walk with no reshuffling. Sketch — the implementing
ticket owns the full zod schema:

```ts
interface ScoreDoc {
  schemaVersion: 1;
  id: string;                       // ulid
  meta: { title: string; source: 'generated' | 'authored' | 'imported'; ... };
  staves: StaffDef[];               // piano v1: [treble, bass]
  measures: Measure[];
}

interface Measure {
  id: string;
  n: number;                        // 1-indexed
  keySig?: KeySig;                  // present when it changes
  timeSig?: TimeSig;
  tempo?: { bpm: number; unit: Duration };
  staves: MeasureStaff[];           // parallel to StaffDef[]
}

interface MeasureStaff { staffId: string; voices: Voice[] }
interface Voice { id: string; events: Event[] }

type Event = Note | Chord | Rest | TupletGroup;

interface Note {
  id: string;
  pitch: { step: 'A'|'B'|'C'|'D'|'E'|'F'|'G'; alter: -2|-1|0|1|2; octave: number };
  duration: { base: DurBase; dots: 0|1|2 };   // rational, never floats
  tie?: 'start' | 'stop' | 'both';
  slur?: SlurRef[];
  articulations?: Articulation[];
  fingering?: 1|2|3|4|5;
}
```

Rules that matter more than the field list:

- **Ids on everything semantic** — notes, chords, rests, voices, measures.
  Minted at creation (ulid), never reused, never derived from position.
- **Durations are rational** (base + dots + tuplet ratio via `TupletGroup`
  wrapping), never milliseconds or floats. Time-in-ms is a *derived* view
  (tempo × position), which is what playback and MIDI assessment consume.
- **Deterministic serialization**: the same ScoreDoc produces byte-identical
  MEI (stable attribute order, ids passed through as `xml:id`). This makes
  engraving snapshot-testable and generation reproducible end-to-end.
- **Explicit beaming** derived from meter by the serializer (MEI encodes
  beams; we don't hand engraving decisions to chance). Manual beam overrides
  are an E3 editor concern, not a v1 model field.

## Rendering pipeline

```
native:   ScoreDoc ──toMei()──▶ MEI ──renderWithTimemap()──▶ SVG + timemap
                                        (toolkit.ts, unchanged)
foreign:  MusicXML / MEI / ABC ─────────renderToSvg()───────▶ SVG
legacy:   ABC (drills, thumbnails) ─────renderToSvg()───────▶ SVG   (unchanged)
```

`app/src/verovio/toolkit.ts` already supports `inputFrom: 'mei'` — it just
has no callers yet. The existing ABC paths (library thumbnails, drills,
piece views) keep working untouched; they migrate to ScoreDoc
opportunistically, not as a project. The sargam substrate explicitly stays
its own renderer per [world-notation.md](world-notation.md) — the anchor
model below is substrate-tagged so annotations *could* span both someday,
but unification is a non-goal.

## Anchors and the annotation model

This is the load-bearing contract shared with both companion docs. An
**anchor** says *where* something attaches; an **annotation** is the thing
attached; a **layer** groups annotations for toggling and attribution.

```ts
type Anchor =
  | { kind: 'elements'; ids: string[] }                        // semantic: native scores
  | { kind: 'measureRange'; from: number; to: number }          // coarse: foreign scores, sections
  | { kind: 'region'; measureId: string;                        // stamps/ink: coords normalized
      x: number; y: number; w: number; h: number }              //   to the measure's bbox
  | { kind: 'timeRange'; startMs: number; endMs: number };      // recordings (see recordings doc)

interface Annotation {
  id: string;
  target: { kind: 'score' | 'recording'; id: string };
  layerId: string;
  anchor: Anchor;
  body: TextBody | HighlightBody | SymbolBody | InkBody;
  author:
    | { kind: 'user'; userId: string }
    | { kind: 'system'; producer: string; runId?: string };     // provenance hook
  createdAt: string; updatedAt: string; deletedAt?: string;
}

interface Layer {
  id: string; target: Annotation['target'];
  name: string; role: 'user' | 'system';
  defaultVisible: boolean;
}
```

Decisions inside this contract:

- **Geometry is never stored for element anchors.** Position is resolved at
  render time by id lookup in the SVG — the `heatmap.ts` pattern
  (querySelector a group, `getBBox()`, inject an overlay rect) generalized.
  Annotations therefore survive re-layout, zoom, page-size changes, and any
  edit that doesn't delete the anchored elements.
- **Region anchors are measure-relative**, normalized to the measure's
  bounding box — so a circled passage or an ink scribble degrades gracefully
  when the measure moves or resizes across renders.
- **Orphans are kept, never silently dropped.** If an edit deletes an
  anchored element, the annotation is flagged orphaned and surfaced in a
  gutter for the user to re-anchor or discard.
- **Machine marks and human marks are one mechanism.** The section heatmap
  becomes a system layer. MIDI assessment verdicts (sight-reading doc) and
  extraction outputs (recordings doc) arrive as system-authored annotations
  whose `author.runId` points at the provenance record that produced them.
  One renderer, one toggle UI, one persistence path.

## The ScoreSurface component stack

The UI over the libraries is a stack of coordinated layers, each already
foreshadowed by existing code:

```
ScoreSurface
├── EngravingLayer      Verovio SVG            (Score.tsx grows into this)
├── AnnotationLayer     overlay SVG; anchors resolved → geometry per render
├── InteractionLayer    hit-testing via element ids, selection model, tool modes
└── CursorLayer         timemap playback cursor (SessionScore.tsx pattern)
```

- **Selection model**: a set of element ids, plus range selection by
  measure/beat. `onElementClick` in `Score.tsx` and
  `findMeasureNumber` in `heatmap.ts` are the seeds.
- **Tool modes**: `select` | `annotate:text` | `annotate:highlight` |
  `annotate:symbol`, with `edit` and `annotate:ink` arriving in later
  stages. Desktop-first (the primary practice/marking device is the
  laptop): hover affordances, keyboard shortcuts, precise click targets.
  Ink is deferred but the `region` anchor + `InkBody` (stroke points) mean
  the data model won't need to change when a pencil shows up.

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

Every mutation is a **command over ScoreDoc** (do/undo pair) — undo/redo
falls out, and the editor never touches MEI or SVG. After each command the
surface re-renders through Verovio; at exercise scale (8–32 bars) this is
milliseconds. If page-scale scores make it sluggish, `measureRange`
re-rendering (already supported in `toolkit.ts`) is the escape hatch —
measure first, optimize second.

## Persistence and the two shapes

- **Native scores**: a `scores` table, ScoreDoc as JSONB — the
  `saved_chords.identity` precedent (`IdentityJSON`, JSONB on Postgres)
  at document scale. Derived MEI and SVG are never stored; they're
  recomputed (persist the source, derive the rest).
- **Foreign artifacts**: bytes in Garage via the media machinery in
  [recordings-provenance.md](recordings-provenance.md); a row referencing
  the storage key.
- **Annotations + layers**: rows per the contract above, on the standard
  mixins (client-mintable UUID, timestamps, soft delete, owner).
- **Two shapes** ([DEPLOYMENT.md](../DEPLOYMENT.md)): the public build
  renders bundled scores exactly as today; scores/annotations persistence
  gates on `backendEnabled` like saved chords (`src/config.test.ts`
  enforces the discipline).

## Design decisions worth knowing

- **One engraver.** Verovio stays the only staff renderer; no VexFlow/OSMD
  second stack. Its MEI `xml:id` passthrough + timemap is the property the
  whole architecture rests on, and it's already paid for (~3 MB WASM,
  loaded once).
- **The editor edits ScoreDoc, never MEI/SVG.** MEI is a compilation
  target. This is what keeps the editor tractable.
- **Native scope grows by evidence,** the sargam way — each addition to the
  model (new event kind, new notation feature) arrives with a real need, a
  serializer clause, and a snapshot test.
- **Annotations are anchored semantically, positioned at render time.**
  Never persist pixel geometry against element anchors.
- **System output is annotations.** Anything that wants to mark a score
  (assessment, extraction, heatmaps) goes through the same layer mechanism
  with provenance attribution — no bespoke overlay paths.

## Deliberately not yet

- **Ink/pencil marking** — modeled (`region` + stroke payload), not built;
  desktop-first for now.
- **Sargam unification** — separate substrate by prior decision; anchors
  are substrate-tagged if we ever want cross-substrate annotations.
- **Collaborative editing / CRDTs** — single-tenant app; the offline-ready
  columns are as far as we go.
- **MNX** — watched, not adopted; MEI-via-Verovio is proven here today.
- **Server-side rendering** — stays client-side per the `ChordIdentity`
  rule until a real batch need arrives, at which point Verovio-in-Python
  behind the job boundary is the named path (backend README).
- **PDF/photo display and OMR** — foreign-tier citizens by design; the
  capture/storage half lives in the recordings doc's media machinery, and
  OMR-to-ScoreDoc promotion is future work on the importer.

## Implementation seeds (for grooming)

| Seed | Scope | Tier |
|---|---|---|
| ScoreDoc schema + zod + toMei() + snapshot tests | pattern-setter; the contract everything consumes | T3 |
| ScoreSurface stack (engraving/annotation/interaction/cursor layers) | refactor Score.tsx/heatmap.ts into the stack | T2 |
| Anchor resolution + overlay renderer | element/measureRange/region anchors → geometry | T2 |
| Annotations + layers persistence (backend tables, API, client) | standard CRUD on the mixins | T1 |
| Heatmap → system layer migration | mechanical once layers exist | T0 |
| MusicXML→ScoreDoc importer (native subset) | promotion path | T2 |
| E1 structured entry (cursor, palette, MIDI step-entry) | first editor stage | T2 |
