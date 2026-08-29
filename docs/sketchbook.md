# The sketchbook: musical ideas as the primary object

Soundings has had a Sketchbook tab since the first mock
(`app/src/views/SketchbookView.tsx`, static data in `app/src/data/sketches.ts`):
pieces in motion, a scratch-ideas stream, voice memos, a lyric/harmony/plan
view per sketch. It has never persisted anything. Meanwhile the REAPER
platform repo (`reaper-and-vst-coding`) has been circling the same problem
from the DAW side — an `ideas/inbox/` export, a music-VCS ideation, a
composition lifecycle (capture → triage → sketch → arrange → produce) — and
keeps concluding that the durable asset is *not* the `.RPP`.

The 2026-08-29 conversation vendored in [sketchbook-vendored.md](sketchbook-vendored.md)
names the resolution both repos were converging on, and this doc adopts it
as the sixth roadmap workstream:

> **The musical thought is the primary object. MIDI, audio, scores, DAW
> projects, analyses and prose are attachments to it. REAPER is one editor
> that can be launched on it — not where the knowledge lives.**

Companion docs: [recordings-provenance.md](recordings-provenance.md)
(the media machinery and the provenance contract this doc reuses
wholesale), [score-substrate.md](score-substrate.md) (ScoreDoc, the
editable form a harmony/melody attachment can take), and the REAPER repo's
`docs/background-investigation.md` §"The VCS boundary" and
`docs/startup-orchestrator-design.md` §11, which already name this app as
the browser-side home for the composition workflow.

## Why it lives in Soundings, not a new app

| Option | For | Against |
|---|---|---|
| **New "composition notebook" app** | Clean slate; the vendored doc sketches it standalone | A third repo with a second copy of Garage plumbing, mixins, auth seam, k3s chart, and the two-shape discipline; ideas and practice would be two silos for one musical life |
| **Inside the REAPER repo** | Closest to the MIDI | Lua + a DAW host is the wrong place for a web notebook; that repo's own framing (§2.5, orchestrator §11) explicitly defers the browser control plane to *this* app |
| **Soundings, sixth workstream** ✅ | The substrate is already designed: Garage buckets + Postgres contracts (service-0263), the media/provenance tables, ScoreDoc, the annotation model, the `subject` convention; the Sketchbook tab already exists as a mock | Adds a personal-media surface to an app whose public shape must stay static — but recordings already crossed that line, with the `backendEnabled` gate as the fence |

The decisive argument is the **subject convention** (`app/src/data/subject.ts`,
`practice_sessions.subject_id`): an idea becomes one more `SubjectKind`.
A practice session can sit in front of a sketch; a recording can be *of* an
idea; a generated sight-reading exercise can be forked *into* an idea. One
notebook, one timeline, one search — that is the point of the exercise.

## The object

One primitive, deliberately under-typed: **capture first, structure later.**

```
ideas {
  id (uuid), handle (int, per-user sequence, immutable — "#183" in prose),
  title?, body (markdown), status: inbox|active|shelved|done,
  kinds text[]    -- free vocabulary: melody, harmony, rhythm, section,
                  -- thought, reference, sketch, composition, analysis …
  tags text[],
  key?, meter?, bpm?,          -- optional, human- or machine-filled
  captured_at, + standard mixins (client-mintable UUID, timestamps,
                  soft delete, owner)
}
```

Not an enum for `kinds`: the vendored doc's `THING-183` that later acquires
`type = [harmony, transition]` is the normal life of an idea, and the
existing mock already blurs song / étude / fragment. `status` *is* a small
enum because the inbox is a product feature (below). The three maturity
levels the vendored doc distinguishes — tiny idea, developed sketch, actual
composition — are **derived, not stored**: a composition is an idea that
has an `.rpp` attachment; a developed sketch has more than one musical
attachment. Nothing to keep in sync.

`body` is the notes markdown the mock already renders (with its `[section]`
markers and `{ }` annotations); `[[#183]]` in the body is a link to another
idea and is parsed into an edge on save, so **backlinks are free**.

### Attachments — raw is immortal, derived is recomputable

```
idea_assets {
  id, idea_id, revision (int, ≥1),
  role: melody|harmony|bass|drums|full|render|score|rpp|reference|image|other,
  filename, storage_key (content-addressed: media/<sha256[:2]>/<sha256>),
  mime, bytes, sha256,
  run_id?              -- set ⇒ derived by a named producer; unset ⇒ raw
}
```

This is the recordings doc's `recording_tracks` shape with two additions.
**`run_id`** applies the provenance spine to files: a render made by
FluidSynth or by REAPER has a run behind it (producer, version, params) and
can be regenerated or superseded; a `.mid` you played in is raw and never
deleted. Losing `piano-v3.opus` costs nothing; losing `melody.mid` loses the
idea. **`revision`** gives every idea a linear history of attachment sets:
"Save to Sketchbook" from REAPER writes revision *n+1*, and earlier
revisions stay (rows are cheap). Storage keys are content-addressed so forks
and revisions that share bytes share objects.

Bytes go to the `soundings-{dev,prod}` Garage buckets through exactly the
media machinery the recordings doc specifies (API-mediated upload,
streaming, sha256). That seed is now shared by two workstreams and is the
first thing to build.

### Relationships — the DAG lives in the app

```
idea_links {
  id, from_id, to_id,
  kind: derived_from|variant_of|resembles|might_fit_with|inspired_by|
        incorporated_into|responds_to|mentions,
  note?, + mixins
}
```

Versioning follows the vendored doc's advice, sharpened into one rule:
**linear history inside an object, a DAG between objects.** Revisions of the
same idea (the REAPER round-trip) are `idea_assets.revision`; a *fork* is a
new idea row plus a `variant_of` edge. The version tree the vendored doc
draws is a view — the connected component over `variant_of`/`derived_from`
— not a table. `mentions` edges are machine-derived from `[[#n]]` in bodies
and recomputed on every save.

No Git branches for musical thinking. Git *may* return later as an export
target (below), never as the versioning mechanism.

### Collections — membership, not ownership

```
collections { id, title, body?, + mixins }
collection_items { collection_id, subject_kind, subject_id, position }
```

Items are subjects, not just ideas: "things that might become Piece A" can
hold ideas, a recording, a repertoire piece, a generated exercise. The same
motif sits in five collections.

## The inbox and quick capture

The killer feature the vendored doc names — *don't make me classify this* —
is `status: inbox`. Capture requires only one of: a line of text, or an
attachment. Title, kinds, tags, links all come later, or never.

Three capture paths, one table:

1. **Browser quick capture** — a hotkey in the app: text box, optional
   file, optional **Web MIDI record** (desktop Chrome, the same Web MIDI
   machinery as sight-reading assessment and E1 step-entry) that writes a
   `.mid` attachment from ten seconds of noodling.
2. **REAPER ideas-inbox export** — the REAPER repo's `service-0005`
   ticket writes `.mid` + JSON sidecar (date, project, tempo, note count,
   pitch-class histogram, key guess) into `ideas/inbox/`. Soundings adds
   the receiving end: `POST /v1/ideas/inbox` accepting that sidecar +
   file, creating an inbox idea with the sidecar's facts landed as
   extracted properties whose producer is the REAPER script and its
   version. The push is a one-line `curl` from the ReaScript
   (`ExecProcess`) or a folder watcher on the studio machine — thin either
   way.
3. **Voice/audio capture** — is a **recording** (MediaRecorder, tracks,
   provenance) whose subject is an idea, or no subject at all and therefore
   an inbox item by definition. Audio brought in as a *file* (a reference
   snippet, a REAPER bounce) is an idea asset. One rule: *captured by the
   app → recording; brought to the app → asset.* Both show on the idea
   page.

The sidebar count on the Sketchbook nav item becomes the inbox count.

## Machine-derived facts: the provenance contract, reused

Key, tempo, note count, pitch-class histogram, duration — the vendored doc
lists these as "analysis"; here they are **extracted properties** exactly
as in the recordings doc, produced by named runs. Two producers in v1:

| Extractor | Runs where | Produces |
|---|---|---|
| `midi-features` (mido/pretty_midi, CPU) | the backend job worker | `key_guess`, `tempo`, `note_count`, `pitch_class_histogram`, `duration_ms`, `piano_roll_summary` |
| `reaper-capture-sidecar` | already ran in REAPER; imported verbatim | the same kinds, attributed to the script version that computed them |
| `midi-render` (FluidSynth + a good piano SF2, CPU) | mlserve, one more systemd FastAPI service | an `idea_asset` with `role: render`, opus, `run_id` set — the **audition preview** that makes the stream view playable seconds after capture |

Two facts make this cheap: the `extraction_runs` / `extracted_properties`
tables and the queued→worker→mlserve loop are already specified; and the
sidecar's numbers are not a second source of truth but one more attributed
producer, so a later `midi-features` run supersedes them by the normal
newest-succeeded-run rule.

**Amendment to the recordings contract** (recorded there too): runs are
keyed by *subject* — `(subject_kind, subject_id)` with `input_sha256s` — not
by `recording_id`, so one table serves recordings, idea assets, and
whatever comes next.

## Portability without a third store

The vendored architecture has Postgres + object store + Git, with the Git
workspace holding `manifest.yaml` + `notes.md` per idea so "even if your app
disappears ten years from now, the repository is still comprehensible." The
property is right; a live three-way sync is the wrong way to get it.

Decision: **Postgres is the index, Garage is the bytes, and portability is
an export** —

```
export/ideas/0183/
  manifest.yaml     id, handle, title, status, kinds, tags, key/meter/bpm,
                    links (by handle), assets (role, filename, sha256,
                    revision, producer if derived), properties (with lineage)
  notes.md
  assets/…          raw and derived bytes, by filename
```

The manifest schema is defined up front and guarded by a round-trip test
(export → import → identical rows). Exporting to a directory, a tarball, or
a Gitea repo are three sinks over the same function. One write path, no
sync engine, and the ten-year guarantee holds.

## REAPER: a subordinate editor, three seams

Nothing in this doc's first two phases needs REAPER or the Windows VM.
The seams are designed so that when the studio machine exists they are
additive:

1. **Inbound — Save to Sketchbook.** `service-0005` (REAPER repo) exports;
   `POST /v1/ideas/inbox` (this repo) receives. A second REAPER action,
   "save revision of #183", posts the current tracks' MIDI as revision
   *n+1* of an existing idea. The sidecar JSON schema is **owned by the
   REAPER repo** (its ticket, its Lua specs) and carries a `schema_version`;
   Soundings validates it with pydantic and refuses unknown majors.
2. **Outbound — Open in REAPER.** The idea page offers a bundle (the
   export format above, zipped). The REAPER repo owns turning a bundle
   into a scratch project: one track per `role`, routed to the shared
   piano/bass/drums instruments of its P1 rig catalog ("bake once, insert
   forever"), from a template `.RPP`. Soundings never writes RPP. For
   *compositions* (ideas with an `.rpp` asset) the bundle carries the
   project file and the action opens it instead.
3. **Render farm — piano / trio renders.** `reaper -renderproject` headless
   on the studio machine, the REAPER repo's held Castalia render-harness
   lane, becomes the `reaper-render` extractor: a run row in Soundings, a
   render agent on the studio host that polls for queued renders, an asset
   landing with `run_id` set. Its `params` must record host OS, REAPER
   version, and rig version — the REAPER repo's DM3 warning that a render
   is valid for one OS + plugin-version combination is, in provenance
   terms, just more params to hash.

Transport for 2 and 3 is deliberately dumb in v1 — download a zip, or a
watched folder on the studio machine — because the studio machine is not
settled yet. The homelab repo's `docs/music-vm-design.md` puts a Windows
VM (vmid 133 on `pve-tower01`; two USB controllers via VFIO, no GPU
passthrough, Sunshine/Moonlight for the display) on the critical path:
host-side work is merged, the attended one-way vfio bind (`infra-0371`) is
in progress as of 2026-08-28, and the Windows install (`infra-0349`), the
latency gate (`infra-0351`) and the library SSD (`infra-0350`) queue behind
it. The Mac stays a first-class host (REAPER repo DM1). A proper agent on
the studio host is phase-3 work that lands after the VM has been played
on for a while — the music-VM design (§13) and the orchestrator doc (§11)
both defer the browser control plane to this app on exactly that
condition. When it arrives, the VM design's §9 machine-readable
**environment report** is the natural thing to hash into every
`reaper-render` run's `params`: it already exists to pin device identity
and versions, which is precisely what makes a render reproducible.

## UI: projections over one set of objects

The vendored five views, mapped onto the existing mock:

| View | v1 | Later |
|---|---|---|
| **Stream / journal** (default) | reverse-chronological ideas + recordings, inline preview player, inbox filter | recordings and practice sessions interleaved (one timeline) |
| **Idea page** | notes (markdown, `[[#n]]`), attachments by revision with play/download, properties with lineage badges, links in/out, "open in REAPER" bundle | version tree, harmony/melody attachments that are ScoreDoc → engraved and editable via the score substrate |
| **Search** | Postgres full-text over title/body/tags + `tag:` `kind:` `key:` `status:` filters | embeddings on the inference box ("find similar ideas") |
| **Collections** | — | membership lists; drag from stream |
| **Graph** | — | the edge table drawn; needs enough nodes to be worth it |

The mock's lyric/harmony/plan tabs survive as sections of the idea page:
lyric and plan are body markdown; harmony is an attachment that is either
ABC (foreign, render-only) or ScoreDoc (native, editable). The static mock
itself stays as the **public-build showcase** — same pattern as recordings:
personal media exists only in the homelab shape, gated on `backendEnabled`.

## Design decisions worth knowing

- **The thought is the object; files are attachments.** Everything else
  is a consequence: under-typed ideas, revisions on assets, forks as
  edges.
- **Raw immortal / derived recomputable** applies to bytes via
  `idea_assets.run_id`, not only to jsonb properties.
- **Linear inside, DAG between.** Revisions are per-idea integers; forks are
  new ideas plus an edge. No Git for musical versioning.
- **Portability is an export**, not a third store. Manifest schema first,
  round-trip test, then sinks.
- **One capture rule**: captured by the app → recording; brought to the
  app → asset. No second audio stack.
- **REAPER never becomes canonical**, and Soundings never writes `.RPP`.
  The REAPER repo owns the sidecar schema and the bundle→project action;
  this repo owns the API, the tables, and the export format. Every
  cross-repo contract has a version field.
- **Ideas are subjects.** `SubjectKind` gains `'idea'`; sessions,
  recordings, and collections all address ideas through the existing
  convention.

## Deliberately not yet

- **Git as a sink** — designed as one export target, not built.
- **In-browser piano roll / MIDI editor** — the score substrate's E1 path
  is the editor; a MIDI→ScoreDoc quantizing importer is the promotion path
  and is future work on the importer, like OMR.
- **Studio-host agent** (proper transport for Open-in-REAPER and renders)
  — after the Windows VM is live and used; zip/folder first.
- **Embeddings, similarity, LLM-assisted analysis** — the inference LXC
  exists; the evidence (hundreds of ideas) does not.
- **Graph view** — drawn when there is a graph.
- **Sharing/export to other people, multi-user** — single-tenant.

## Sequencing against the rest of the roadmap

Verified 2026-08-29: the shared substrate for this app is **fully
provisioned** — `soundings_{dev,prod}` databases with their six roles and
the `soundings-{dev,prod}` buckets with scoped keys exist on the NAS (infra
repo service-0263 + fix-0219, `labctl deploy nas-services` run). What is
still missing before anything here can deploy is the rest of
`_grooming-k3s-onboarding.md`: the Woodpecker registry secrets (ops-0001,
still unset — the only image build on main errored at the push step and no
image exists), then T3 (the gitops chart, mirroring `reading-list`) and T4
(rollout verification). That is the gate for every persisting workstream,
not just this one.

After it, the shared media plumbing seed is the first code for *both* the
recordings and sketchbook workstreams, and the sketchbook is the better
first tenant for it (CRUD + upload, no MediaRecorder, no extractor needed
to be useful). Sight-reading generation stays the top product priority and
is unaffected — it is client-side and shares nothing here except the
`subject` convention.

## Implementation seeds (for grooming)

| Seed | Scope | Tier |
|---|---|---|
| Garage media plumbing (shared with recordings doc; content-addressed keys, sha256, streaming upload) | storage pattern-setter, first tenant = ideas | T2 |
| `ideas` / `idea_assets` / `idea_links` schema + Alembic + CRUD + `[[#n]]` link extraction | the object; handle sequence; inbox status | T2 |
| Sketchbook UI v1: stream, idea page, quick capture (text + file), inbox filter, tags/links | replaces the mock behind `backendEnabled`; mock stays as showcase | T2 |
| Search: tsvector + filter grammar | small, high value after month one | T1 |
| Export bundle: manifest schema + round-trip test + directory/zip sinks | the portability guarantee | T1 |
| Provenance tables generalized to subjects (amendment) + `midi-features` extractor in the job worker | first use of the provenance contract | T2 |
| Web MIDI quick capture → `.mid` attachment | shares Web MIDI code with assessment/E1 | T2 |
| `midi-render` FluidSynth service on mlserve + `render` role previews | mirrors existing mlserve services; makes the stream playable | T2 |
| `POST /v1/ideas/inbox` receiver for the REAPER sidecar (pydantic schema pinned to the REAPER repo's `service-0005`) | inbound seam; cross-repo contract | T1 |
| `subject.ts` gains `'idea'`; sessions/recordings can target ideas | small, unlocks the one-timeline story | T1 |
| Phase 2: fork + version tree, collections, backlinks view | after v1 has ideas in it | T2 |
| Phase 3 (REAPER repo, cross-repo): bundle→scratch-project action; `reaper-render` agent; "save revision" action | needs the studio host; groomed in that repo | T2 |
