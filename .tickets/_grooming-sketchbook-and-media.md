---
title: Sketchbook, media plumbing, provenance, recordings — plus the score and sight-reading spines (grooming)
status: open
---

## Context

Grooms the implementation seeds of four design docs into loop-runnable
tickets, now that the deploy gate (`_grooming-k3s-onboarding.md` T1–T4) has
cleared and both slots are live:

- [docs/sketchbook.md](../docs/sketchbook.md) — the sixth workstream; the
  first tenant of the shared media plumbing.
- [docs/recordings-provenance.md](../docs/recordings-provenance.md) — media
  machinery, the provenance contract (runs keyed by subject), the job worker,
  mlserve extractors.
- [docs/score-substrate.md](../docs/score-substrate.md) — ScoreDoc, anchors,
  annotation layers, the editor path.
- [docs/sight-reading-generation.md](../docs/sight-reading-generation.md) —
  taxonomy, scorer, generator, assessment, calibration.

**Audit method (2026-09-02).** Read every file the seeds name; grepped the
frontend for backend callers and for Web MIDI / MediaRecorder code; read the
gitops chart values, the Woodpecker workflows, the mlserve playbook in the
infra repo, and the REAPER repo's ideas-inbox ticket; checked Gitea for open
PRs (none) and pruned stale remote branches. Findings that shaped the tickets:

- **Backend** (`backend/app`): FastAPI + sync SQLAlchemy 2.0, one Alembic
  migration (`0001_initial`: users, saved_chords, practice_sessions), mixins
  for client-mintable UUID / timestamps / soft delete / owner, owner-scoped
  repositories, camelCase DTOs, RFC 9457 errors, a committed `openapi.json`
  with drift tests on both sides of the contract. **No S3 code and no S3
  dependency** — the chart already delivers `S3_ENDPOINT`, `S3_REGION`,
  `S3_BUCKET`, `S3_FORCE_PATH_STYLE` (values) and `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY` (SOPS secret) to the api pod, but `Settings` has no
  field for any of them.
- **Tests**: the default pytest suite is SQLite in-memory (13 tests, green in
  CI since fix-0003). The `integration` marker needs testcontainers, i.e.
  Docker, which this laptop never gets — so anything Postgres-only (tsvector,
  JSONB operators, sequences) is CI/deploy-verified only. See OPS2.
- **Frontend**: only saved chords call the backend (`api/chords.ts`,
  `hooks/useSavedChords.ts`). `PracticeSessionDto` is generated but has no
  caller. `SketchbookView.tsx` is a static mock over `data/sketches.ts`; the
  sidebar's Sketchbook count is hardcoded `3`. `SubjectKind` is
  `'piece' | 'scale'`. `app/e2e/stats-and-sketchbook.spec.ts` asserts the
  mock's exact shape (lyric markers, five chord symbols, the Verovio harmony
  SVG, the "Blue Light" empty state) — the mock must keep rendering
  unchanged on the public build.
- **No Web MIDI, no `getUserMedia`, no `MediaRecorder`** anywhere in
  `app/src`. Playwright browsers are **not installed** on this laptop, so
  `npm run test:e2e` is a down substrate here (and installing them is
  forbidden by the disk rule).
- **Verovio**: `toolkit.ts` accepts `inputFrom: 'mei'` with no callers;
  `Score.tsx` exposes `onSvgReady` / `onElementClick`; `heatmap.ts` paints
  per-measure rects; `SessionScore.tsx` drives a timemap cursor;
  `useMetronome.ts` is a Web Audio metronome. These are the seeds the score
  substrate refactors.
- **Deploy**: both slots roll on every push to `main` with the same image
  tags. There is no way to verify a `deployed` criterion before a merge
  reaches prod. See OPS1.
- **Cross-repo state**: the REAPER repo's ideas-inbox export (`service-0005`,
  Ticket 15 in its `_grooming-platform-and-capture-pilot.md`) is
  **unclaimed** — the sidecar schema this app is supposed to validate does
  not exist yet. The infra repo's mlserve pattern is one FastAPI file under
  `ansible/files/mlserve/`, one entry in each of four loops in
  `ansible/playbooks/mlserve-setup.yml`, and a port var in
  `ansible/inventory/group_vars/all/ml-platform.yml`; ports 8001–8004 are
  taken.

**Tier vocabulary.** T0 haiku · T1 sonnet · T2 sonnet/high · T3 opus · F
frontier (human-dispatched, never auto-picked) · H human. This replaces the
S/O/H tags the k3s doc used; `.tickets/loop.md` §Model routing carries the
mapping.

**Stable labels.** `MD` media plumbing · `SB` sketchbook · `PV` provenance +
jobs · `RC` recordings · `OPS` CI/deploy · `SC` score substrate · `SR`
sight-reading · `F` frontier reviews. Branch numbers are minted by
`branch-new` at claim time and appear only in claim marks.

**Substrates used in criteria** (probes in `.tickets/loop.md`): `unit` =
vitest / pytest, always available; `ci` = the Woodpecker workflow for the
pushed SHA (Dockerfiles, Postgres-only paths); `deployed` = the dev slot
`https://soundings-dev.k8s.bittern-chameleon.dev` after the merge rolls
(`ssh dev-workshop kubectl` for pod-side checks). The laptop cannot reach
Garage directly (no S3 hostname by design), so every Garage-touching check is
`deployed`.

---

## F-class shortlist — read this first

Two items pass the frontier tests (one-shot, upstream blast radius, no gate
catches a subtly wrong answer, small token surface). Both are **spec reviews,
not implementation**, and both must land before the spines they govern are
built. Neither blocks the sketchbook, media, provenance, or recordings
spines, so the loop has ~20 tickets of runnable work regardless.

**Both dispatched and reviewed 2026-09-02 (`docs-0006`).** The amendments
are folded into the two docs (each ends with a "what changed and why" list
for the ratifying reader); the SC and SR spines below are seeded from the
amended versions; the review's Verovio evidence lives in
`docs/probes/verovio/` and is re-runnable. Ratification = the merge of the
docs-0006 PR. Side effects on already-groomed tickets are marked
*(F1 amendment)* / *(F2 amendment)* in PV1, RC1, SB7 and the Deferred list.

### F1 — Adversarial review of the ScoreDoc model and the anchor/annotation contract  `[claimed: docs-0006 — reviewed 2026-09-02]`
**Tier:** F
**Why:** Every semantic element id in ScoreDoc becomes the identity in the
database row, the MEI `xml:id`, the SVG `<g>`, the timemap, the annotation
anchor, and the assessment verdict. The generator, the annotation layers,
the recording bridge, and the editor all build on it. A wrong call here
(rational-duration model, voice/tuplet containment, the `Anchor` union,
orphan semantics, id minting) propagates into every downstream ticket and
no snapshot test can tell a wrong model from a right one.
**Scope:** one-shot adversarial pass over `docs/score-substrate.md` §ScoreDoc
shape, §Rendering pipeline, §Anchors and the annotation model, and
§Persistence, against Verovio's MEI import behaviour and the three consumer
docs. Output is amendments to the doc, ratified by Nick, then SC1 is
seeded.
**Acceptance criteria:**
- [x] Amendments committed to `docs/score-substrate.md` with a "Reviewed
      2026-09-02 (F1)" line — human-ratified by the docs-0006 merge (substrate: H)
- [x] SC1's scope updated here to match, and its `[not seeded]` mark removed

### F2 — Adversarial review of the technique taxonomy, rung ladders, level presets, and attribution rules  `[claimed: docs-0006 — reviewed 2026-09-02]`
**Tier:** F
**Why:** The doc's own words: "Get it wrong and every exercise downstream is
miscalibrated in a way no test suite catches; that is why this doc exists
before any code." The scorer's fixtures pin whatever ladder they are given —
they cannot detect that the ladder is wrong. This is the single highest
leverage review in the whole roadmap, and sight-reading is the top product
priority.
**Scope:** one-shot adversarial pass over `docs/sight-reading-generation.md`
§The technique taxonomy, §The difficulty model, §Assessment (attribution
rules), §Calibration, from the standpoint of a piano pedagogue and of the
generator that must satisfy the ceilings per measure. Output is amendments,
ratified by Nick, then SR1 is seeded.
**Acceptance criteria:**
- [x] Amendments committed to `docs/sight-reading-generation.md` with a
      "Reviewed 2026-09-02 (F2)" line — human-ratified by the docs-0006 merge (substrate: H)
- [x] SR1's scope updated here to match, and its `[not seeded]` mark removed

**Decided 2026-09-02:** both dispatched, neither waived. SC1 and SR1 are
loop-eligible once the docs-0006 PR is merged; the loop no longer reports
the F decisions when it runs dry.

---

## Media plumbing

### MD1 — Garage media store: settings, content-addressed keys, streaming upload with sha256, health probe
**Tier:** T2 (storage pattern-setter; the donor for SB2 and RC1)
**Depends on:** —
**Why:** Two workstreams need bytes in Garage and neither can start until the
backend can talk to it. The credentials are already in the pod, unused.
**Scope / surfaces / files:**
- `backend/pyproject.toml`: add `boto3` (runtime); tests use botocore's
  `Stubber`, no moto, no network.
- `backend/app/config.py`: `s3_endpoint`, `s3_region`, `s3_bucket`,
  `s3_access_key_id`, `s3_secret_access_key`, `s3_force_path_style`
  (all optional; `storage_configured` property). Names match the chart's
  env exactly (`charts/soundings/values.yaml` `config:` + the SOPS secret).
- `backend/app/storage.py`: a `MediaStore` protocol (`put_stream`,
  `open_stream`, `stat`, `delete`, `healthcheck`) with `S3MediaStore`
  (boto3, path-style, single bucket) and `MemoryMediaStore` (tests).
  `put_stream(fileobj, mime)` spools to a temp file while hashing, then
  uploads to the content-addressed key `media/<sha256[:2]>/<sha256>` and
  returns `StoredBlob(storage_key, sha256, bytes, mime)`. Re-putting
  identical bytes is a no-op hit (same key).
- `backend/app/deps.py`: `MediaStoreDep` — `S3MediaStore` when configured,
  `MemoryMediaStore` otherwise (dev/test), so the SQLite path stays usable.
- `backend/app/routers/health.py`: `/healthz` gains `storage:
  ok | unconfigured | error` via `healthcheck()` (`head_bucket`), never
  failing the probe on `unconfigured`.
- Streaming download helper: `StreamingResponse` over `open_stream` with
  `Content-Type`, `Content-Length`, and `ETag: "<sha256>"`.
**Acceptance criteria:**
- [ ] `put_stream` on a 3 MB random payload yields the expected sha256 and
      key, and a second put of the same bytes performs no upload — `cd
      backend && uv run pytest -q tests/test_storage.py` (substrate: unit)
- [ ] `S3MediaStore` issues `PutObject`/`GetObject`/`HeadObject` with the
      path-style endpoint and bucket from settings — botocore `Stubber`
      (substrate: unit)
- [ ] `/healthz` returns `storage: unconfigured` with no S3 env and
      `storage: error` when `head_bucket` raises — (substrate: unit)
- [ ] Gates green; `openapi.json` + `schema.d.ts` regenerated if `/healthz`
      schema changed — `.tickets/loop.md` §Gates (substrate: unit)
- [ ] After merge, `curl https://soundings-dev.k8s.bittern-chameleon.dev/api/healthz`
      reports `storage: ok` (substrate: deployed)

---

## Sketchbook

### SB1 — `ideas` + `idea_links` schema, handles, CRUD, `[[#n]]` link extraction
**Tier:** T2 (first non-trivial domain object; sets the pattern for every table after it)
**Depends on:** —
**Why:** The object the whole workstream is about. Nothing persists today.
**Scope / surfaces / files:**
- `backend/app/models/idea.py`: `Idea` (`handle` int, `title?`, `body` text
  default `''`, `status` enum `inbox|active|shelved|done` default `inbox`,
  `kinds` + `tags` as JSON-with-JSONB-variant lists, `key?`, `meter?`,
  `bpm?`, `captured_at`, standard mixins; unique `(user_id, handle)`) and
  `IdeaLink` (`from_id`, `to_id`, `kind` enum per the doc, `note?`, mixins;
  unique `(from_id, to_id, kind)`).
- Handle minting: `max(handle)+1` per user inside the insert transaction,
  retried on the unique violation — no Postgres sequence, so SQLite tests
  cover it.
- `backend/app/links.py`: pure `extract_handles(body) -> set[int]` for
  `[[#183]]`; `mentions` edges are recomputed on every create/update
  (delete stale, insert new). Links to unknown handles are dropped silently.
- Routers under `/v1/ideas`: list (filters `status`, `kind`, `tag`; newest
  `captured_at` first; paginated `Page`), create (only `body` or nothing is
  required — inbox capture), get (includes links in/out with the other
  idea's handle+title), patch, delete (soft). `/v1/ideas/{id}/links`: post
  (typed edge to another idea by id) and delete.
- Migration `<next>_ideas` (number and `down_revision` from `alembic heads`
  at claim time — every migration in this doc); `openapi.json` +
  `schema.d.ts` regenerated.
- Derived maturity (idea / sketch / composition) is **not** stored.
**Acceptance criteria:**
- [ ] Two creates for the same user get handles 1 and 2; a soft-deleted
      idea's handle is never reused — `uv run pytest -q tests/test_ideas.py`
      (substrate: unit)
- [ ] Creating an idea whose body contains `[[#1]]` produces one `mentions`
      edge to handle 1; editing the body to remove it removes the edge; a
      `[[#999]]` to nothing produces no edge and no error (substrate: unit)
- [ ] Status/kind/tag filters and the empty-body inbox create round-trip
      through the API; list order is newest first (substrate: unit)
- [ ] `tests/test_openapi_drift.py` and `npm run gen:api:check` pass on the
      regenerated contract (substrate: unit)
- [ ] After merge, the migrate Job completes on both slots and
      `POST /api/v1/ideas {"body":"hello"}` on the dev slot returns 201 with
      `handle: 1` (substrate: deployed)

### SB2 — `idea_assets`: upload, revisions, `run_id`, streaming download
**Tier:** T2 (first tenant of MD1)
**Depends on:** MD1, SB1
**Why:** Attachments are what make an idea more than a note; this is the
first real bytes-through-Garage path.
**Scope / surfaces / files:**
- `backend/app/models/idea.py`: `IdeaAsset` (`idea_id`, `revision` int ≥ 1,
  `role` enum per the doc, `filename`, `storage_key`, `mime`, `bytes`,
  `sha256`, `run_id?` uuid — FK to `extraction_runs.id` added here if PV1
  has already landed, else by PV1's migration; mixins).
- `POST /v1/ideas/{id}/assets` multipart (`file`, `role`, optional
  `new_revision` bool): streams through `MediaStoreDep.put_stream`; default
  revision = the idea's current max (1 if none); `new_revision=true` bumps
  it. Response is the asset row.
- `GET /v1/ideas/{id}/assets` (grouped by revision, newest first),
  `GET /v1/ideas/{id}/assets/{asset_id}/content` (streaming, `ETag`),
  `DELETE` soft-deletes the row and **never** deletes bytes (raw is
  immortal; a janitor is future work).
- Upload size cap via settings (`media_max_upload_bytes`, default 200 MB) →
  413 problem+json.
- Migration `<next>_idea_assets`; contract regenerated.
**Acceptance criteria:**
- [ ] Upload → row has the sha256 of the bytes sent, `revision` 1; a second
      upload with `new_revision=true` gets `revision` 2 and the first row is
      still listed — `uv run pytest -q tests/test_idea_assets.py`, with
      `MemoryMediaStore` (substrate: unit)
- [ ] `GET .../content` streams the exact bytes with the right `Content-Type`
      and `ETag` (substrate: unit)
- [ ] Oversize upload → 413 problem+json; delete → 404 on subsequent get but
      the store still holds the key (substrate: unit)
- [ ] Gates green; contract regenerated (substrate: unit)
- [ ] After merge: upload a 1 MB file to an idea on the dev slot, download
      it, `sha256sum` matches; `ssh dev-workshop kubectl -n soundings-dev logs
      deploy/soundings-api` shows no storage errors (substrate: deployed)

### SB3a — Sketchbook UI: live stream, inbox filter, quick capture (text + file)
**Tier:** T2 (replaces a mock with the first live personal-media surface; sets the live/mock split)
**Depends on:** SB2
**Why:** The tab exists and persists nothing. The inbox is the product.
**Scope / surfaces / files:**
- `app/src/api/ideas.ts` (list/create/get/patch/delete/links/assets over
  the generated client) and `app/src/hooks/useIdeas.ts` (same shape as
  `useSavedChords`: `enabled`, data, error, actions; fetches only while the
  view is active).
- `app/src/views/SketchbookView.tsx` becomes a switch: `backendEnabled` →
  `SketchbookLive`; else the existing mock, moved verbatim to
  `SketchbookMock.tsx`. The mock's DOM must not change (the e2e spec pins
  it). The sidebar count becomes the inbox count when live, `3` otherwise.
- `SketchbookLive`: reverse-chronological stream of ideas (handle, title or
  first body line, status chip, kinds/tags, captured time), an `inbox`
  filter toggle, and a quick-capture box (textarea + optional file input +
  hotkey `c` when the view is focused) that POSTs an inbox idea and, if a
  file was chosen, uploads it as an asset with `role` guessed from mime
  (`audio/midi` → `melody`, `audio/*` → `reference`, image → `image`, else
  `other`).
- `app/src/styles/app.css`: reuse the existing sketch-grid / idea-card
  classes; no new design system.
**Acceptance criteria:**
- [ ] With `VITE_API_BASE_URL` unset the mock renders exactly as before —
      `cd app && npm run test` includes a `SketchbookView.test.tsx` asserting
      the mock markers/chords, and `config.test.ts` still passes
      (substrate: unit)
- [ ] With a mocked client, `SketchbookLive` renders the stream newest-first,
      the inbox toggle hides non-inbox ideas, and submitting the capture box
      calls create with the typed body then clears — `SketchbookLive.test.tsx`
      (substrate: unit)
- [ ] Capture with a `.mid` file calls the asset upload with `role: melody`
      (substrate: unit)
- [ ] Gates green (typecheck, gen:api:check, vitest, build) (substrate: unit)
- [ ] After merge, on the dev slot: capture "test #1" from the UI, reload,
      it is in the stream; the sidebar count reads the inbox size
      (substrate: deployed)

### SB3b — Idea page: body editor with `[[#n]]` links, attachments by revision, status/kinds/tags editing
**Tier:** T2
**Depends on:** SB3a
**Why:** The stream is for capture; the idea page is where structure arrives
later.
**Scope / surfaces / files:**
- `app/src/views/IdeaPage.tsx` (rendered inside `SketchbookLive` on click):
  title (inline edit), body as markdown with the mock's `[section]` markers
  and `{ }` annotations preserved (reuse `LyricBlock` logic) plus `[[#n]]`
  rendered as links that navigate to that idea; save on blur/Ctrl-S via
  patch.
- Attachments panel: grouped by revision, each with filename, role chip,
  size, download link (`.../content`), inline `<audio>` for `audio/*`
  assets; upload button with role picker and a "new revision" checkbox.
- Metadata rail: status select, kinds + tags as editable chips, key /
  meter / bpm fields; links in/out list with kind labels.
- Props with lineage badges: placeholder section that PV3 fills
  (`<PropertiesPanel>` renders "no extracted properties yet").
**Acceptance criteria:**
- [ ] Body containing `[[#2]]` renders a link whose click selects idea with
      handle 2; editing and blurring calls patch with the new body —
      `IdeaPage.test.tsx` with a mocked client (substrate: unit)
- [ ] Attachments render grouped by revision; an `audio/webm` asset gets an
      `<audio>` element with the content URL (substrate: unit)
- [ ] Status change calls patch; adding a tag chip calls patch with the
      merged tag list (substrate: unit)
- [ ] Gates green (substrate: unit)
- [ ] After merge, on the dev slot: open idea #1, add tag `test`, reload, tag
      persists; upload a small `.opus`, the player appears and plays
      (substrate: deployed)

### SB4 — Ideas become subjects: `SubjectKind` gains `'idea'`, "Practice this" from an idea
**Tier:** T1
**Depends on:** SB3b
**Why:** The decisive argument for living in Soundings: one timeline. A
practice session can sit in front of a sketch.
**Scope / surfaces / files:**
- `app/src/data/subject.ts`: `SubjectKind` adds `'idea'`; `resolveSubject`
  stays synchronous for bundled subjects; new `subjectFromIdea(idea)` builds
  a `Subject` (title = title or `#<handle>`, byline = kinds joined, abc =
  undefined, meter = idea.meter or `4/4`, bpm = idea.bpm or 80,
  `hasPieceDetail: false`). Subject ids for ideas are `idea:<uuid>`.
- `App.tsx` / `SessionView.tsx`: `startSession('idea:<uuid>')` resolves via
  `useIdeas` when live; return view is `sketchbook`. SessionView renders
  without a score when `abc` is undefined (already tolerated — verify).
- `IdeaPage.tsx`: "Practice this" button.
- Backend: none — `practice_sessions.subject_id` is a free string.
**Acceptance criteria:**
- [ ] `subjectFromIdea` unit-tested for titled/untitled and with/without
      meter+bpm — `subject.test.ts` (substrate: unit)
- [ ] Starting a session from an idea renders SessionView with the idea's
      title and no score block, and ending it returns to the sketchbook —
      RTL test (substrate: unit)
- [ ] Gates green; `config.test.ts` still proves the public build never
      references the live path (substrate: unit)

### SB5 — Search: Postgres full-text + filter grammar, search box on the stream
**Tier:** T1
**Depends on:** SB1 (OPS2 for its `ci` criterion)
**Why:** Small and high value once there are more ideas than fit on a screen.
**Scope / surfaces / files:**
- `backend/app/search.py`: pure `parse_query(q) -> ParsedQuery` for
  `tag:x kind:y key:z status:s` tokens plus free text (unit-tested).
- Migration `<next>_ideas_search`: Postgres-only generated `search_tsv`
  tsvector column over title/body/tags + GIN index (guarded by
  `op.get_bind().dialect.name == 'postgresql'`); model declares the column
  with a SQLite no-op variant.
- `GET /v1/ideas?q=` applies filters as `WHERE`s and free text as
  `plainto_tsquery` on Postgres / `LIKE` on SQLite (same results on the
  fixtures either way; ranking only on Postgres).
- `SketchbookLive`: search input with 250 ms debounce feeding `q`.
**Acceptance criteria:**
- [ ] `parse_query('tag:piano kind:melody blue light')` yields the three
      parts; unknown prefixes stay free text — `tests/test_search.py`
      (substrate: unit)
- [ ] API filters by tag/kind/status and matches free text on the SQLite
      path (substrate: unit)
- [ ] `pytest -m integration` against Postgres passes for the tsvector
      path — needs OPS2 (substrate: ci)
- [ ] After merge, on the dev slot: `GET /api/v1/ideas?q=hello` returns idea
      #1 (substrate: deployed)

### SB6 — Export bundle: manifest schema, round-trip test, directory and zip sinks
**Tier:** T1
**Depends on:** SB2
**Why:** The ten-year guarantee. Manifest first, then sinks.
**Scope / surfaces / files:**
- `backend/app/export/manifest.py`: pydantic `IdeaManifest`
  (`schema_version: 1`, id, handle, title, status, kinds, tags, key, meter,
  bpm, links by handle, assets with role/filename/sha256/revision/producer,
  properties with lineage — properties empty until PV1 lands, shape fixed
  now).
- `backend/app/export/bundle.py`: `export_idea(db, store, idea) ->
  Iterator[(path, bytes)]` yielding `manifest.yaml`, `notes.md`,
  `assets/<revision>/<filename>`; `import_bundle(db, store, entries)` that
  recreates rows (new ids, same handles if free) and re-puts bytes.
- Sinks over the same iterator: `write_directory(path)`,
  `GET /v1/ideas/{id}/export` streaming a zip.
**Acceptance criteria:**
- [ ] Round trip: create an idea with two assets and one link, export to a
      temp dir, import into a fresh DB + store, compare rows field-by-field
      (excluding ids/timestamps) and asset sha256s — `tests/test_export.py`
      (substrate: unit)
- [ ] The zip endpoint returns a valid archive whose `manifest.yaml`
      validates against `IdeaManifest` (substrate: unit)
- [ ] Gates green; contract regenerated (substrate: unit)

### SB7 — Web MIDI quick capture → `.mid` attachment
**Tier:** T2 (first Web MIDI code; shared later by assessment and E1 step entry)
**Depends on:** SB3a
**Why:** Ten seconds of noodling into the inbox, no DAW. This is the capture
path the studio machine cannot replace.
**Scope / surfaces / files:**
- `app/src/midi/access.ts`: `useMidiInputs()` over
  `navigator.requestMIDIAccess` (feature-detected; absent → the UI hides the
  button), device list, `onMessage` subscription.
- `app/src/midi/recorder.ts`: pure `MidiRecorder` collecting note on/off +
  timestamps from a `MIDIMessageEvent` stream; `stop()` returns events.
  Constructor options `{ origin: 'first-note' | 'external'; t0Ms?: number;
  silenceTimeoutMs: number | null }` so sight-reading assessment (SR6) can
  anchor the clock to the count-in downbeat and disable the silence
  timeout instead of forking the recorder *(F2 amendment 2026-09-02)*;
  the sketchbook uses `{ origin: 'first-note', silenceTimeoutMs: 10000 }`.
- `app/src/midi/smf.ts`: pure Standard MIDI File type-0 encoder
  (`{ tempoBpm = 120, ppq = 480, markers?: [{ tick, text }], meta?:
  [{ text }] }`, variable-length deltas) — unit-tested against known byte
  sequences; no new dependency. `tempoBpm` is quarter-note bpm (SMF
  semantics); SR6 passes the locked attempt tempo converted to quarter
  terms, a `bar1` marker and the clock-anchor text meta.
- `SketchbookLive` capture box: "Record MIDI" button → arm → first note
  starts the clock → stop button or 10 s silence ends → uploads
  `capture-<timestamp>.mid` as `role: melody` on a new inbox idea (or on
  the open idea page as a new revision).
**Acceptance criteria:**
- [ ] `smf.ts` encodes a fixed two-note sequence to the expected bytes,
      including correct variable-length deltas across the 127 boundary —
      `smf.test.ts` (substrate: unit)
- [ ] `MidiRecorder` fed a scripted event stream produces the right
      note list with durations; silence timeout fires (fake timers)
      (substrate: unit)
- [ ] With a fake `MIDIAccess` injected, the capture button appears, and a
      scripted recording uploads a `.mid` asset (substrate: unit)
- [ ] Gates green (substrate: unit)
- [ ] Verify note (not a gate): with a real keyboard in desktop Chrome on
      the dev slot, a recorded phrase appears as an asset and PV3 later
      extracts a plausible key (substrate: deployed, hardware)

### SB8 — `POST /v1/ideas/inbox`: receiver for the REAPER sidecar  `[not seeded: REAPER service-0005 is unclaimed — the sidecar schema it owns does not exist yet]`
**Tier:** T1
**Depends on:** SB2, PV1 (and the REAPER sidecar schema)
**Why:** The inbound seam. The doc pins this endpoint's pydantic schema to
the REAPER repo's sidecar schema and version.
**Scope / surfaces / files:** multipart `file` + `sidecar` JSON; validate
`schema_version` major; create an inbox idea with the `.mid` as a `melody`
asset and the sidecar's `tempo`, `note_count`, `pitch_class_histogram`,
`key_guess` landed as extracted properties of a run whose producer is
`reaper-capture-sidecar@<script_version>` (needs PV1). Refuse unknown
majors with 422.
**Acceptance criteria:** written when the schema exists.
**Unblock:** claim Ticket 15 in `reaper-and-vst-coding` (its deps
`service-0004` ← `infra-0007` are also unclaimed), or decide here that this
repo proposes the v1 schema and the REAPER ticket adopts it.

---

## Provenance and jobs

### PV1 — Provenance tables keyed by subject, canonical params hash, run + property API
**Tier:** T2 (the contract every machine-derived datum lands through)
**Depends on:** —
**Why:** "Every derived datum names its producer." Nothing derived may exist
before these tables do; SB2 already reserves `run_id`.
**Scope / surfaces / files:**
- `backend/app/models/provenance.py`: `ExtractionRun` (`subject_kind`,
  `subject_id` **str** in the house `kind:<uuid>` form — matches
  `practice_sessions.subject_id` and RC1 *(F1 amendment 2026-09-02)*,
  `input_sha256s` JSON list, `extractor`, `extractor_version`,
  `model_ref?`, `executor` enum `worker|client|external` *(F2 amendment)*,
  `params` JSON, `params_hash`, `status` enum
  `queued|running|succeeded|failed`, `started_at?`, `finished_at?`,
  `error?`, mixins; unique `(subject_kind, subject_id, extractor,
  extractor_version, params_hash)` — `params` always carries the sorted
  `input_sha256s`, so two inputs of one subject never collide) and
  `ExtractedProperty` (`run_id` FK, `kind`, `time_range?` JSON, `payload`
  JSON, `confidence?`).
- `backend/app/provenance.py`: `canonical_params_hash(params)` = sha256 of
  sorted-keys compact JSON, computed after the server folds the sorted
  `input_sha256s` into `params.inputSha256s` (clients never include it);
  `latest_properties(db, subject)` = newest succeeded run per `(extractor,
  kind)`.
- `subject_id` stores the full subject string exactly as
  `practice_sessions.subject_id` does (`kind:<uuid>` for uuid-backed kinds
  — idea, score, exercise, recording — and the bare bundled id for
  `piece`/`scale`); `subject_kind` is the kind denormalised for filtering;
  in `/v1/subjects/{kind}/{id}/…` `{id}` is the bare id and the server
  composes the string. PV3/RC5/SR7 pass the composed string.
- `backend/app/config.py`: `client_extractors: list[str] = ['midi-matcher',
  'scorer', 'musicxml-import', 'reaper-capture-sidecar']` (CSV-splittable
  like `cors_origins`) — the allow-list for `executor: 'client' |
  'external'` completed-run bodies.
- Migration `<next>_provenance` (number and `down_revision` from `alembic
  heads` at claim time). The FK `idea_assets.run_id → extraction_runs.id`
  is owned by whichever of SB2 / PV1 lands *second*: if `idea_assets`
  already exists this migration adds it; otherwise SB2's migration adds it.
- Routes: `POST /v1/runs` accepts either an **enqueue** body (`executor:
  'worker'`, row created `queued`) or a **completed-run** body (`executor:
  'client' | 'external'`, `status: 'succeeded' | 'failed'`, `properties`
  inline — run and properties inserted in one transaction; the extractor
  name must be in `settings.client_extractors`, else 422); returns the
  existing row with 200 on an idempotent hit (posted properties discarded),
  201 otherwise. `GET /v1/runs/{id}`, `GET /v1/subjects/{kind}/{id}/properties`
  (latest per kind, each with `run` lineage inline),
  `GET /v1/subjects/{kind}/{id}/runs`.
**Acceptance criteria:**
- [ ] Same params in different key order hash identically; a changed value
      changes the hash — `tests/test_provenance.py` (substrate: unit)
- [ ] Enqueuing twice with identical inputs returns the same run id; runs
      are never updated in place by the API (patch is not exposed)
      (substrate: unit)
- [ ] A completed-run body for an allow-listed client extractor lands a
      `succeeded` run with its properties in one transaction; a second
      identical post is a 200 hit with no duplicate properties; a
      worker-only extractor name with `executor: 'client'` is a 422
      (substrate: unit)
- [ ] With two succeeded runs of one extractor, `properties` returns only
      the newer run's property per kind and both remain in `runs`
      (substrate: unit)
- [ ] Gates green; contract regenerated (substrate: unit)
- [ ] After merge, the migrate Job completes on both slots (substrate: deployed)

### PV2 — Job worker: queued runs → extractor registry → properties, embedded in the api process
**Tier:** T2 (the app's first background execution path)
**Depends on:** PV1
**Why:** Enqueue→poll, never inline. The thinnest thing that works: a loop
over queued rows, no broker.
**Scope / surfaces / files:**
- `backend/app/jobs/registry.py`: `Extractor` protocol (`name`, `version`,
  `run(ctx) -> list[PropertyOut | AssetOut]`), `register()` decorator, a
  built-in `sha256-echo` extractor (returns the input hashes as a property)
  used by tests.
- `backend/app/jobs/worker.py`: `run_once(db)` claims the oldest queued run
  with `SELECT … FOR UPDATE SKIP LOCKED` on Postgres (plain select on
  SQLite), flips to `running`, executes, writes properties/assets in one
  transaction, flips to `succeeded`/`failed` with `error` text; `run_forever`
  polls every `worker_poll_seconds`. `python -m app.jobs.worker --once` for
  ops.
- `backend/app/main.py`: lifespan starts the worker in a daemon thread when
  `settings.worker_embedded` (default `true`; `false` in tests via
  conftest). One replica in-cluster, so this is safe today; a separate
  worker Deployment is a later gitops ticket if ever needed.
- Extractor context gives read access to the subject's inputs via the media
  store (idea asset bytes by sha256).
**Acceptance criteria:**
- [ ] `run_once` takes a queued `sha256-echo` run to `succeeded` with one
      property whose payload lists the input hashes; a raising extractor
      ends `failed` with the exception text and no partial properties —
      `tests/test_worker.py` (substrate: unit)
- [ ] Two `run_once` calls on one queued run never double-execute it
      (substrate: unit)
- [ ] The embedded thread does not start when `worker_embedded=false`
      (substrate: unit)
- [ ] After merge: enqueue a `sha256-echo` run via the API on the dev slot;
      within 30 s `GET /runs/{id}` is `succeeded` (substrate: deployed)

### PV3 — `midi-features` extractor + auto-enqueue on MIDI asset upload + properties panel
**Tier:** T2 (first real extractor; the key-guess has judgment)
**Depends on:** PV2, SB2
**Why:** First use of the provenance contract on real data; makes the
inbox self-describing seconds after capture.
**Scope / surfaces / files:**
- `backend/pyproject.toml`: add `mido` (pure Python).
- `backend/app/jobs/extractors/midi_features.py` (`midi-features@1.0.0`):
  `key_guess` (Krumhansl–Schmuckler correlation over the pitch-class
  histogram, major/minor), `tempo` (first tempo meta or 120), `note_count`,
  `pitch_class_histogram` (12 floats summing to 1), `duration_ms`,
  `piano_roll_summary` (lowest/highest pitch, mean polyphony).
- SB2's upload path enqueues a `midi-features` run for `audio/midi` assets
  with `input_sha256s=[asset.sha256]`, subject = the idea.
- `IdeaPage` `<PropertiesPanel>`: renders latest properties with lineage
  badges ("key guess: F♯ minor — midi-features 1.0.0 · 2 Sep").
**Acceptance criteria:**
- [ ] Fixture MIDI files (C major scale, A minor arpeggio, a chromatic run)
      yield the expected `key_guess`, `note_count`, and a histogram summing
      to 1 ± 1e-6 — `tests/test_midi_features.py` (substrate: unit)
- [ ] Uploading a `.mid` asset creates one queued run keyed on the asset
      hash; uploading the same bytes again does not create a second run
      (substrate: unit)
- [ ] `PropertiesPanel` renders a lineage badge per property — RTL test
      (substrate: unit)
- [ ] After merge: upload a `.mid` on the dev slot; the idea page shows a
      key guess within 30 s (substrate: deployed)

### PV4 — `midi-render` FluidSynth service on mlserve  `[cross-repo: homelab_infra_and_planning]`
**Repo:** homelab_infra_and_planning (claimed there with its numbering and worktree rule; that repo's gates apply)
**Tier:** T1 (mirrors the four existing mlserve services)
**Depends on:** — (cross-repo)
**Why:** The audition preview that makes the stream playable.
**Scope / surfaces / files:**
- `ansible/files/mlserve/midi_render.py`: FastAPI, `POST /render`
  (multipart `.mid`, optional `soundfont` name) → `audio/ogg` opus bytes via
  `fluidsynth -F` + `ffmpeg`/`opusenc`; `GET /health`.
- `ansible/playbooks/mlserve-setup.yml`: apt `fluidsynth`,
  `fluid-soundfont-gm`, `opus-tools`; entries in the apps loop, the
  systemd-unit loop (`midi-render`, port `{{ mlserve_midi_render_port }}`),
  the enable loop, and the health-wait loop.
- `ansible/inventory/group_vars/all/ml-platform.yml`:
  `mlserve_midi_render_port: 8005`, `mlserve_midi_render_soundfont:
  /usr/share/sounds/sf2/FluidR3_GM.sf2`.
- Deploy is attended: `scripts/labctl deploy mlserve --force`.
**Acceptance criteria (in that repo):**
- [ ] Playbook lint/check gates green there
- [ ] `curl -F file=@fixture.mid http://mlserve:8005/render` returns opus
      bytes that `ffprobe` reads as audio > 0 s (substrate: deployed,
      attended)
- [ ] Claimed-branch name recorded back here

### PV5 — `midi-render` extractor: preview renders as `role: render` assets, play button on the stream
**Tier:** T1 (mirrors PV3's extractor shape)
**Depends on:** PV3, PV4 (`deployed`)
**Why:** Closes the loop: capture → key guess → playable preview.
**Scope / surfaces / files:**
- `backend/app/config.py`: `midi_render_url` (optional; unset → extractor
  reports `failed: unconfigured`).
- `backend/app/jobs/extractors/midi_render.py` (`midi-render@1.0.0`, params
  `{soundfont}`): POSTs the `.mid` to PV4, stores the opus via the media
  store as an `IdeaAsset` with `role: render`, `run_id` set, same revision
  as the source asset.
- Auto-enqueue alongside PV3 on MIDI upload; the stream shows an inline
  player for the newest `render` asset of each idea.
**Acceptance criteria:**
- [ ] With `httpx.MockTransport` standing in for mlserve, the run succeeds
      and the render asset row has `run_id` = the run and the source
      asset's revision — `tests/test_midi_render.py` (substrate: unit)
- [ ] With `midi_render_url` unset the run fails cleanly with an
      `unconfigured` error and no asset (substrate: unit)
- [ ] After merge, with PV4 live: upload a `.mid` on the dev slot; a play
      button appears on the stream card within a minute and plays
      (substrate: deployed)

---

## Recordings

### RC1 — `recordings` + `recording_tracks` schema, CRUD, track upload and streaming
**Tier:** T1 (mirrors SB1/SB2 on the same store)
**Depends on:** MD1
**Why:** The tables the capture UI, the extractors, and tempo-vs-target
all hang on.
**Scope / surfaces / files:**
- `backend/app/models/recording.py`: `Recording` (`subject_kind?`,
  `subject_id?` str — both NULL for free practice and sketchbook voice
  captures; otherwise the same string as `practice_sessions.subject_id`
  and PV1, ideas included, `session_id?`
  FK, `captured_at`, `duration_ms?`, `notes?`, mixins) and `RecordingTrack`
  (`recording_id`, `kind` enum `audio|midi`, `storage_key`, `mime`,
  `bytes`, `sha256`, `offset_ms` int NOT NULL DEFAULT 0 — track start
  minus `captured_at`, the recording clock *(F1 amendment 2026-09-02)*,
  mixins). A recording may be MIDI-only (a sight-reading attempt is one);
  no audio track is required.
- Routes: `POST /v1/recordings`, `GET /v1/recordings?subjectKind=&subjectId=`
  (newest first), `GET /v1/recordings/{id}`, `PATCH` (notes,
  duration), `DELETE` (soft), `POST /v1/recordings/{id}/tracks` multipart,
  `GET .../tracks/{id}/content` streaming.
- Migration `<next>_recordings`; contract regenerated.
**Acceptance criteria:**
- [ ] Create + upload an audio track → sha256 matches, listing by subject
      returns it newest first, content streams back byte-identical —
      `tests/test_recordings.py` (substrate: unit)
- [ ] A MIDI-only recording with `offset_ms: 250` round-trips through the
      API and the track row carries the offset; a recording with no subject
      round-trips and lists when `?subjectKind=` is absent (substrate: unit)
- [ ] Gates green; contract regenerated (substrate: unit)
- [ ] After merge, migrate Job green on both slots and a `curl` round trip
      on the dev slot succeeds (substrate: deployed)

### RC2 — Capture UI: MediaRecorder in SessionView, takes list with playback
**Tier:** T2 (first `getUserMedia` surface)
**Depends on:** RC1
**Why:** The "recording" badge in SessionView finally becomes real.
**Scope / surfaces / files:**
- `app/src/media/recorder.ts`: `useAudioRecorder()` over `getUserMedia` +
  `MediaRecorder` (`audio/webm;codecs=opus` when supported, else the
  browser default), returning `state`, `start`, `stop() -> Blob`,
  `elapsedMs`; feature-detected.
- `app/src/api/recordings.ts` + `hooks/useRecordings(subjectId, active)`.
- `SessionView.tsx`: record / stop control next to the timer (gated on
  `backendEnabled` and feature support); on stop, `POST /v1/recordings`
  with the current subject + session bpm as `notes`-free metadata, then the
  track upload; a "takes" list under the score with `<audio>` playback.
- `PieceView.tsx`: takes list for the piece (read-only).
- MIDI-in-parallel tracks are deferred to a follow-up after SB7 lands.
**Acceptance criteria:**
- [ ] With a fake `MediaRecorder` + `getUserMedia`, start → stop produces a
      Blob that is uploaded as an `audio` track on a new recording for the
      current subject — RTL test (substrate: unit)
- [ ] The control is absent on the public build and when the API is
      unsupported; `config.test.ts` still passes (substrate: unit)
- [ ] Gates green (substrate: unit)
- [ ] Verify note: record ten seconds on the dev slot in desktop Chrome,
      reload, the take plays back (substrate: deployed, hardware)

### RC3 — Cadence setting and due state
**Tier:** T1
**Depends on:** RC1
**Why:** "Record this weekly" — the periodic half of the workstream, no
scheduler.
**Scope / surfaces / files:**
- `backend/app/models/recording.py`: `RecordingCadence` (`subject_kind`,
  `subject_id`, `interval_days`, mixins; unique per user+subject);
  `PUT /v1/recording-cadences/{subjectKind}/{subjectId}`, `GET` list.
- `app/src/data/cadence.ts`: pure `dueState(lastCapturedAt, intervalDays,
  now) -> 'none' | 'due' | 'overdue'`.
- `SessionView` / `PieceView`: cadence picker (off / 3 / 7 / 14 / 30 days)
  and a due chip.
**Acceptance criteria:**
- [ ] `dueState` covers no-recording, within interval, past interval, and
      past 2× interval — `cadence.test.ts` (substrate: unit)
- [ ] `PUT` upserts; a second `PUT` updates in place — `tests/test_cadence.py`
      (substrate: unit)
- [ ] Gates green; contract regenerated (substrate: unit)

### RC4 — Audio-feature service on mlserve: beat tracking, loudness, waveform peaks  `[cross-repo: homelab_infra_and_planning]`
**Repo:** homelab_infra_and_planning
**Tier:** T2 (the service shell is a mirror; the analysis code is first-of-kind)
**Depends on:** — (cross-repo)
**Why:** The extractors behind tempo-vs-target; the laptop never processes
media.
**Scope / surfaces / files:**
- `ansible/files/mlserve/audio_features.py`: `POST /analyze` (multipart
  audio, `features=[beats,loudness,peaks]`) → JSON `{tempo_curve: [{t_ms,
  bpm}], onsets: [t_ms], loudness: [{t_ms, lufs}], waveform_peaks:
  {bucket_ms, peaks: [[min,max]]}}`; librosa (`beat_track`, onset detection,
  RMS→LUFS-ish), `soundfile`, `ffmpeg` decode for opus/webm; CPU by default.
- Playbook loops + `mlserve_audio_features_port: 8006`; attended deploy.
**Acceptance criteria (in that repo):**
- [ ] A 120 bpm click-track fixture yields a `tempo_curve` within ±2 bpm and
      onsets on the beats — that repo's service tests
- [ ] `/health` 200 after `labctl deploy mlserve` (substrate: deployed,
      attended)
- [ ] Claimed-branch name recorded back here

### RC5 — `beat-tracker`, `loudness`, `waveform-peaks` extractors in the worker, auto-enqueued on audio upload
**Tier:** T1 (mirrors PV5)
**Depends on:** PV2, RC1, RC4 (`deployed`)
**Why:** Lands the properties the recording view consumes.
**Scope / surfaces / files:** `backend/app/config.py` `audio_features_url`;
`backend/app/jobs/extractors/audio_features.py` registering three extractors
(one HTTP call, three runs — each run stores only its own kinds so
supersession stays per `(extractor, kind)`); RC1's track upload enqueues all
three for `audio` tracks with subject = the recording.
**Acceptance criteria:**
- [ ] With `MockTransport`, an audio track upload ends with three succeeded
      runs and properties of kinds `tempo_curve`, `onsets`, `loudness`,
      `waveform_peaks` — `tests/test_audio_extractors.py` (substrate: unit)
- [ ] Unconfigured URL → runs fail cleanly (substrate: unit)
- [ ] After merge, with RC4 live: a take uploaded on the dev slot has a
      `tempo_curve` property within a minute (substrate: deployed)

### RC6 — Recording view: waveform, playback cursor, tempo-vs-target with lineage
**Tier:** T2
**Depends on:** RC5
**Why:** The headline feature of the workstream — a view over properties,
not stored data.
**Scope / surfaces / files:**
- `app/src/views/RecordingView.tsx` (opened from a take in the takes list):
  waveform drawn from `waveform_peaks` (d3, existing chart conventions),
  `<audio>` with a cursor synced to `currentTime`, tempo-vs-target line
  chart (`tempo_curve` vs the session's `bpm`, or the subject's
  `bpmTarget` when no session), lineage badge per property, take notes
  (patch).
- Time-anchored annotations are **not** in this ticket — they arrive with
  SC5 as RC7.
**Acceptance criteria:**
- [ ] Given fixture properties, the view renders a waveform path, a tempo
      line, and a target reference line; missing properties render a
      "pending extraction" state instead of crashing — RTL test
      (substrate: unit)
- [ ] Gates green (substrate: unit)
- [ ] After merge, a take with extracted properties renders on the dev
      slot (substrate: deployed)

---

## CI and deploy

### OPS1 — Preview slot: PR image builds tagged `dev-<sha8>` tracked by the dev slot  `[not seeded: Decision needed]`
**Tier:** T1 (app repo: `.woodpecker/docker.yml`) + T0 (gitops: two annotations)
**Depends on:** — (Decision needed)
**Why:** Today every merge rolls **prod** immediately, and the loop can only
check a `deployed` criterion after that. If PR builds shipped to the dev
slot, the loop could verify on dev *before* merging, and prod would only
ever receive already-verified images. This also gives the dev slot a reason
to exist beyond a second database.
**Scope:** `docker.yml` gains a `pull_request` rule building both images
tagged `dev-${CI_COMMIT_SHA:0:8}`; gitops `apps/soundings-dev.yaml`
`allow-tags: regexp:^dev-[0-9a-f]{8}$` with `update-strategy: newest-build`,
and `apps/soundings.yaml` keeps `^[0-9a-f]{7,40}$` (bare sha8 only, so prod
never picks a `dev-` tag). No local gate for either half (CI-only, by
design); the PR body says so.
**Decision needed:** the dev slot stops mirroring prod and starts tracking
the newest PR build from *any* branch. Yes / no.
**Acceptance criteria:** a PR push produces `dev-<sha8>` images
(substrate: ci); the dev slot rolls to them within one Argo poll and prod
does not (substrate: deployed).

### OPS2 — Real-Postgres backend tests in CI  `[merged: ci-0001, PR #10, 2026-09-02]`
**Tier:** T1
**Depends on:** —
**Why:** The SQLite suite cannot exercise tsvector (SB5), JSONB operators,
`SKIP LOCKED` (PV2), or the Alembic migrations themselves — today those are
proven only by the migrate Job in prod. `.woodpecker/README.md` already
sketches the step.
**Scope / surfaces / files:**
- `.woodpecker/backend.yml`: a `postgres:16` service and a `test-postgres`
  step running `uv run pytest -q -m integration` with
  `DATABASE_URL=postgresql+psycopg://…@postgres:5432/…`.
- `backend/tests/test_integration_postgres.py`: drop the testcontainers
  path; use `DATABASE_URL` when set, skip otherwise. Add an Alembic
  `upgrade head` → `downgrade base` → `upgrade head` round trip to it.
- Remove `testcontainers[postgres]` from the dev group (nothing on this
  laptop can use it).
- No local gate (CI-only); the PR body says "verified in CI only" and the
  loop reads the pushed SHA's workflow.
**Acceptance criteria:**
- [ ] `backend` workflow on the pushed SHA shows `test-postgres` green,
      including the migration round trip — Woodpecker API for the PR's SHA
      (substrate: ci)
- [ ] Default `uv run pytest -q` still passes locally and still deselects
      `integration` (substrate: unit)

---

## Score substrate  (seeded 2026-09-02 from the F1-amended `docs/score-substrate.md`)

SC1 is a full ticket; SC2–SC9 stay provisional rows (titles and deps are
current; their acceptance criteria are written when SC1 has landed and the
schema is concrete). Every "verified 4.5.1" behaviour SC1 relies on is
re-runnable via `sh docs/probes/verovio/run-all.sh`.

### SC1 — ScoreDoc schema + validity + `toMei()` + `timeline()` + `renderScoreDoc` + snapshot tests
**Tier:** T3 (pattern-setter; the contract everything consumes)
**Depends on:** —
**Why:** Every semantic element id becomes the identity in the row, the MEI
`xml:id`, the SVG `<g>`, the anchor and the verdict. The F1 review found
that Verovio validates nothing, beams nothing, applies no key signature to
sounding pitch, lists tie-stops as onsets and mints random ids unless told
not to — all of which this ticket owns on the app side.
**Scope / surfaces / files** (all per `docs/score-substrate.md` §ScoreDoc
shape, §Score-time, §Validity, §Rendering pipeline):
- `app/src/score/schema.ts`: zod `ScoreDocSchema` (discriminated `Event`
  union on `kind`, `ElementId` pattern, closed `ScoreMeta`, cardinalities)
  and `validateScoreDoc(doc): Issue[]` with refinements 1–7.
- `app/src/score/ids.ts`: `IdSource`, `seededIdSource(rng)`,
  `randomIdSource()`, kind prefixes, derived-id helpers (the full list in
  §Identity: `-tie`, `-a<i>`, `-fing`, `-acc`, `-beam`, `-s<n>`, `-sb`,
  `-tempo`, `-sdef`, and the fixed document-level ids), and
  `cloneScoreDoc(doc, ids): { doc, idMap }` (re-mints every id including
  spanner endpoints and direction targets, sets `meta.derivedFrom`).
- `app/src/score/fraction.ts`: exact rational arithmetic (reduce, add, mul,
  cmp, `durationOf`).
- `app/src/score/timeline.ts`: `timeline(doc)`, `soundingEvents(doc)`
  (per-pitch `tiedDuration`), `msAt`, `tempoMap`/`msAtMap`,
  `effectiveAttrs`, `beatUnit(timeSig)` — `lib/time.ts beatsPerBar(meter)`
  becomes a wrapper (parse the string into a `TimeSig`, return `count ×
  4/unit ÷ durationOf(beatUnit)`); its signature and `time.test.ts` are
  unchanged.
- `app/src/score/pitch.ts`: `midiOf`, `accidentalState()`, `spellMidi`,
  `transposePitch` (the key/spelling tables come from `theory/keys.ts`,
  which SR1 extracts; until then `pitch.ts` may hold a private copy with a
  TODO naming SR1).
- `app/src/score/mei.ts`: `toMei(doc)` — `meiHead` always; the initial
  `<scoreDef>` in the doc's stated MEI form (key/mode/meter/`midi.bpm`,
  `staffGrp`, `staffDef`); `<scoreDef xml:id="${m}-sdef">` re-declarations
  on change measures; `<staff xml:id="${m}-s${n}">` + `<layer
  xml:id="${voice.id}" n>`; `accid` / `accid.ges` per `accidentalState()`
  (gestural vocabulary `s|ss|f|ff`); `courtesy` as a child `<accid
  xml:id="${note.id}-acc" … func="caution" enclose="paren">` with no
  accidental attributes on the note; `<tie xml:id startid endid>` in the
  start measure; spanners and dynamics hoisted after the staves;
  `<tempo xml:id="${m}-tempo" midi.bpm mm mm.unit mm.dots tstamp="1">` with
  the composed text + SMuFL glyph content; `groupBeams` with the meter
  table, onset assignment, two-or-more rule, tuplet-outer nesting, derived
  beam ids; `<mRest>`; `metcon="false"` for `pickup` and `complement`;
  `<sb xml:id="${m}-sb"/>` for `systemBreak`; stable attribute order.
- `app/src/lib/canonical-json.ts`: RFC 8785 `canonicalJson` (sync);
  `scoreDocHash` (async over `crypto.subtle.digest`).
- `app/src/score/migrate.ts`: the `migrateScoreDoc` chain (v1 identity).
- `app/src/verovio/toolkit.ts`: `renderScoreDoc(doc, { widthPx, measureIds? }):
  Promise<{ svg, timemap, mei }>` — `resetOptions()` first, `inputFrom:
  'mei'`, `breaks: 'encoded'`, `pageWidth` from `widthPx`, `pageHeight:
  60000` + `adjustPageHeight`, `xmlIdSeed: 1` set before every load, never
  `svgHtml5`, `includeRests: true`, asserts one page, `measureIds` →
  `select({ start, end })` + `redoLayout()` with the rendered `g.measure`
  ids asserted equal to the requested range; `TimemapEntry` gains
  `measureOn?`, `restsOn?`, `restsOff?`; the ABC helpers gain
  `resetOptions()` (behaviour otherwise unchanged); foreign renders gain
  `xmlIdChecksum: true` and `svgAdditionalAttribute: ['measure@n']` (SC7
  consumes this entry; it does not re-do it). Verovio tests run under the
  vitest `node` environment (the WASM toolkit loads there; `docs/probes/`
  proves it).
- Fixtures under `app/src/score/__fixtures__/`: an 8-bar grand-staff
  exercise with beams, chords, slurs, a hairpin, dynamics, a tie across a
  barline, a triplet, a key change, a mid-exercise tempo change and a
  `systemBreak`; a pickup + complement fixture; a 6/8 fixture; a 5/8
  fixture with `grouping`; G-major and F-major spelling fixtures, each
  containing one double-sharp and one double-flat note and one cautionary
  accidental; a windowed-render fixture; one negative fixture per
  refinement (including `MeasureRest` in a pickup, `measures[0].tempo`, a
  meter outside the closed set, a ♪♬♪ triplet that must *pass*).
**Acceptance criteria:**
- [ ] `toMei()` is byte-identical across two runs and matches the committed
      MEI snapshot for every fixture — `cd app && npm run test` `mei.test.ts`
      (substrate: unit)
- [ ] `renderScoreDoc` SVG is byte-identical across two calls on one shared
      toolkit and across two fresh toolkits for every fixture —
      `render.test.ts` (substrate: unit)
- [ ] For every fixture, every ScoreDoc element id except `StaffDef.id`
      appears exactly once as an SVG `<g id>` and no `sd…` id appears at all
      (spanning continuations carry `class="… id-X spanning"` and no `id`);
      the union of the timemap's `on` ids equals the set of all Note and
      ChordNote ids — tie-stops included (`exp11`); `soundingEvents(doc)`
      returns exactly the tie-start Note/Chord ids; `MeasureRest` ids never
      appear in the timemap (`exp22` K); `timeline()` onsets equal Verovio
      `qstamp` within 1e-6 for every note and every `<rest>` in `restsOn`;
      the windowed fixture's first timemap entry has `tstamp 0` and the
      cursor offset equals `msAt(onsetOf(window.start))` —
      `timeline.test.ts` (substrate: unit)
- [ ] `getMIDIValuesForElement(id).pitch === midiOf(note.pitch)` for every
      note in the G-major and F-major fixtures, double accidentals and the
      cautionary note included — the `accid.ges` rule; the cautionary note
      renders exactly two paren glyphs and one accid group with our id —
      `pitch.test.ts` (substrate: unit)
- [ ] `validateScoreDoc` rejects each negative fixture (overfull voice,
      dangling tie, orphan tie-stop, duplicate id, `MeasureRest` in a
      pickup, `measures[0].tempo`, courtesy on a written accidental, a
      same-endpoint hairpin, a meter outside the set) with the expected
      `IssueCode`, reports the structural fixtures (nested tuplet, one-note
      chord, wrong staff count, digit-leading id) as `schema`, accepts the
      ♪♬♪ triplet, and `renderScoreDoc` throws on an invalid doc —
      `schema.test.ts` (substrate: unit)
- [ ] `seededIdSource` with one seed mints the same sequence twice; every
      minted id matches the stored pattern exactly, every derived id the
      `-suffix` form, and all are XML NCNames; `cloneScoreDoc` output
      validates, shares no id with its source and remaps every
      `startId`/`endId`/`at` — `ids.test.ts` (substrate: unit)
- [ ] `canonicalJson` matches the RFC 8785 test vectors; `scoreDocHash`
      ignores `revision` — `canonical-json.test.ts` (substrate: unit)
- [ ] The legacy ABC paths are behaviourally unchanged (only
      `resetOptions()` added): existing vitest suites pass unchanged; gates
      green (typecheck, vitest, build) (substrate: unit)
- [ ] `sh docs/probes/verovio/run-all.sh` re-run: the `verovio 4.5.1-…`
      version line is unchanged and every diff against the committed
      `results.txt` is confined to Verovio-minted ids and `*Ms` timings —
      stated in the PR body; `results.txt` is not rewritten (`git checkout`
      it afterwards) (substrate: unit — node script)

| Label | Title | Tier | Depends on |
|---|---|---|---|
| SC2 | ScoreSurface stack: Engraving / Annotation / Interaction / Cursor layers refactored out of `Score.tsx`, `heatmap.ts`, `SessionScore.tsx`; hit-testing to the nearest ScoreDoc-id ancestor; selection model; `onRendered(svg, revision)`; cursor by id with tie-continuation and window offset rules | T2 | SC1 |
| SC3 | Anchor resolution + overlay renderer: every anchor kind (`elements`, `span`, `measures`, `measureIndex`, `scoreTime`, `region` frames, `timeRange`), status enum incl. `unrendered`/`stale-*`, spanning-element `.id-X` union, staff-line region frames, `projectLayer()` for virtual system layers, `MemoryAnnotationStore` | T2 | SC2 |
| SC4 | Scores + layers + annotations persistence: `scores` table (both tiers; native columns), versioned `PUT` (409), contract ownership (Anchor as a Pydantic union with the anchor×target check; opaque body/doc envelopes), layers/annotations API under `/v1/targets/{kind}/{id}`, reachability-through-target, migration, `ApiAnnotationStore`; `SubjectKind` gains `'score'` (`score:<uuid>`) | T2 | SC1 |
| SC5 | Client wiring: annotation tools (text, highlight, symbol) over SC3 persisted via SC4; orphan gutter and re-anchor | T1 | SC3, SC4 |
| SC6 | Section heatmap → virtual system layer over `piece` targets (`measureIndex` anchors parsed once from `Section.range`, `heat` bodies); `heatmap.ts` injection retired | T0 | SC3 |
| SC7 | Foreign score import: `POST /v1/scores/import` over `MediaStoreDep`, `GET /v1/scores/{id}/content`, foreign scores rendered through SC1's foreign `renderToSvg` entry, `render` key on foreign `elements` anchors, `stale-render` status | T1 | SC4, MD1 |
| SC8 | MusicXML → ScoreDoc importer (native subset, fresh ids, `meta.provenance`) + `POST /v1/scores/{id}/promote` (new row, `derived_from`, annotation copy rules) | T2 | SC1, SC7 |
| SC9 | E1 structured entry: `Command` catalogue + pure `apply` with inverse, cursor + overwrite semantics, id-stable undo/redo, paste re-mint, duration palette, MIDI step entry over SB7's hook, fork-on-edit for generated scores | T2 | SC2, SB7 |
| RC7 | Time-anchored user annotations in `RecordingView` on the recording clock over SC3/SC4 | T1 | SC5, RC6 |

## Sight-reading  (seeded 2026-09-02 from the F2-amended `docs/sight-reading-generation.md`)

Top product priority. SR1 is a full ticket; SR2–SR8 stay provisional rows
whose criteria are written when SR1 has landed. SR2 is the thin slice that
makes sight-reading real; SR5 needs only SC1 (rendering), not the SC2
refactor; SR6 needs SC3 (projection) and never SC5 — the previous table
transitively parked MIDI assessment behind the mlserve audio deploy.

### SR1 — Taxonomy v2 module + scorer + level presets + spec normalizer + `theory/keys.ts` + boundary fixtures
**Tier:** T3 (pattern-setter; the shared contract of all three engines)
**Depends on:** SC1
**Why:** The doc's own words: get the taxonomy wrong and every exercise
downstream is miscalibrated in a way no test suite catches. F2 re-cut the
ladders and wrote the feature condition for every rung; this ticket turns
that into data and code with fixtures hand-scored against the doc, never
against the scorer.
**Scope / surfaces / files** (all per `docs/sight-reading-generation.md`
§The technique taxonomy, §Level presets, §Coupling rules, §Operational
definitions):
- `app/src/theory/keys.ts`: `keySignatureMap`, `MAJOR_KEY_ACCIDENTALS`,
  `RELATIVE_MAJOR`, `normalizeAlter` extracted from `chord-identity.ts`
  (which re-imports them, tests unchanged), plus `diatonicPitches(key,
  mode, lo, hi)`, `fifthsOf({ tonic, alter, mode })` and `keySigOf(fifths,
  mode)`; no new `@tonaljs` package.
- `app/src/generation/taxonomy.ts`: `DimId` (15) / `DimKey` (19) /
  `DIM_KEYS` / `RungVector`; `TAXONOMY: Record<DimId, …>` (explicit
  `group`, `perHand`, rung keys/labels/descriptions); `KEY_RUNG` lookup by
  `(fifths, mode)`; `LEVELS` (`Partial<RungVector>` ceilings with the D
  column split and G/I/Q duplicated per hand, plus tempo band in beat bpm,
  shortest-value floor, bars, harmonic rhythm, count-in, anacrusis and
  hands rules); `COUPLING: CouplingRule[]` with ids; `normalizeSpec(spec) →
  EffectiveSpec | SpecUnsatisfiable | SpecInvalid` (derived dimensions from
  `spec.key`/`meter`/`hands`, floor-raising / ceiling-lowering / null
  consequents, fixed iteration order, relaxation trace with rule ids);
  `expandPreset(level, focus)` with the `max(ceiling − 1, closed floor)`
  rule; `levelFor(dim, rung)` = the lowest qualifying level; `Spec` type;
  `taxonomyVersion = '2.0.0'`.
- `app/src/generation/scorer.ts`: `score(doc): FeatureVector | { scorable:
  false, reason }` — every shared definition of §Operational definitions
  (onset via `soundingEvents`, beat grid and beat strength via `beatUnit`,
  Δ staff-step spans, ledger-line count, written accidentals via
  `accidentalState`, syncopation features, runs, phrase grid, 4-bar
  windows, the hand model, rung selection, per-voice aggregation, exact
  rationals), the per-dimension features and rung mappings from the
  per-dimension table (including the LH pattern classifier and
  `restInBeamGroup` via the substrate's `groupBeams`), owners and the
  ceiling check per owning unit, `perMeasure` semantics for every owner,
  the null rule, note tags for all 15 dimensions, `measuresAtMax`, tempo
  features (`bpmBeat`, `bpmQuarter`, `shortestValueMs`), the overall
  scalar; `checkCeilings(vector, spec)` and `occurrenceFloor(vector, spec)`
  for SR2's verify step; `scorerVersion = '1.0.0'`.
- `app/src/generation/__fixtures__/<dimId>/<rungSlug>.at.json` and
  `<rungSlug>.below.json` (`rungSlug` = the part of the rung key after the
  slash), one pair per boundary: minimal ScoreDocs differing in one feature
  across the threshold, each with a hand-written `expect` `{
  taxonomyVersion, dim: DimKey, rung, features }` (exercise-level
  aggregates) and the hand computation in the PR description. The
  Nick-authored reference corpus (one exercise per level) is an H step
  listed in Notes, not a gate.
**Acceptance criteria:**
- [ ] Every boundary fixture pair scores as its hand-written `expect`
      says — `cd app && npm run test` `scorer.test.ts` (substrate: unit)
- [ ] The two syncopation spellings (a half on beat 2 vs two tied quarters)
      score identically; a 6/8 bar of six eighths scores V2 and a 2/2 bar
      of eighths V4; RH C4–G4 in treble scores G1 and B5 G2; a held LH
      whole-note under RH quarters scores H3 and an alternating-hands bar
      H2; a held LH fifth per bar scores P2 and D2; a V chord with G♯ in
      A minor scores A2; a courtesy accidental does not raise
      `pitch.accidentals`; parallel 6ths in both hands do not trigger I5 —
      `scorer.test.ts` (substrate: unit)
- [ ] `normalizeSpec({ key: A minor, accidentals: A1 comfort })` raises
      accidentals to A2 with a trace entry naming `minor-accid`;
      `{ accidentals: A1 focus, key minor }` returns `SpecUnsatisfiable`
      naming the rule; a disagreeing `dims['pitch.key']` is `SpecInvalid`;
      `expandPreset(L6, ['hands.lh_pattern'])` produces no relaxation entry
      — `normalize.test.ts` (substrate: unit)
- [ ] Preset invariants: ceilings non-decreasing per dimension across
      L1–L10 (an absent cell counts as 0); at least one ceiling or parameter
      strictly increases per step; no explicit null, model-gated or V7
      ceiling; every level's full ceiling vector is a fixpoint of the
      coupling closure; for every level and every dimension with ceiling
      ≥ 2 as the sole focus, `normalizeSpec` returns `EffectiveSpec` and
      never `SpecUnsatisfiable` — `levels.test.ts` (substrate: unit)
- [ ] Null rule: an RH-only fixture scores `hands.lh_pattern` and every
      `.lh` key as `null`, passes an L1 ceiling check, and is excluded from
      the overall scalar — `scorer.test.ts` (substrate: unit)
- [ ] `noteTags` names, for a fixture with a leap target, a syncopated
      onset, a written accidental, a shift and a second voice, exactly the
      expected dimensions on exactly the expected notehead ids; every
      dimension at rung ≥ 2 in that fixture has `active > 0` —
      `scorer.test.ts` (substrate: unit)
- [ ] `taxonomyVersion` and `scorerVersion` are stamped on every vector; a
      fixture whose `expect.taxonomyVersion` differs fails the suite —
      `scorer.test.ts` (substrate: unit)
- [ ] `chord-identity.ts` tests unchanged after the extraction; gates green
      (typecheck, vitest, build) (substrate: unit)

| Label | Title | Tier | Depends on |
|---|---|---|---|
| SR2 | Generator thin slice: `Spec` schema, harmonic skeleton with A-gated chord pools, rhythm-per-phrase from a cell vocabulary, motif/pattern-tile realization, legality pass (spelling via `pitch.ts`, tie-vs-value, courtesy), verify (validity + ceilings + occurrence floor + tempo band + coherence C1–C6), candidate ranking, recipe with per-candidate PRNG streams, relaxation stages and the failure type; `hands: 'rh' \| 'lh'` single line at L1–L2; recipe fixtures pin exact output | T3 | SR1 |
| SR3 | Generator breadth: hands together H2–H7, LH pattern classes P1–P7, rhythm grammars to V6, compound meters, expression decoration (C7), anacrusis, 12/16/24-bar forms | T3 | SR2 |
| SR4 | Printable set: N recipes with sequential sub-seeds at A4/Letter width, `breaks: 'encoded'`, short-code header, recipe-URL footer, `@media print` | T1 | SR5 |
| SR5 | Exercise player view: preview → count-in → play → self-report lifecycle; `useMetronome` clock contract (count-in, `onGridStart`, output latency, latency trim, grouping, accent schedule for 5/8 and 7/8); `subjectFromExercise` + `Subject.score` (adds a `renderScoreDoc` branch to `Score.tsx` only; no changes to `SessionScore.tsx` — the `bar`/`beat` guides are SC2-gated); recipe URL; nav entry; public build ephemeral; `config.test.ts` | T2 | SR2, SC1 |
| SR6 | Web MIDI capture (SB7 recorder, `origin: 'external'`) + SMF encode via SB7's `smf.ts` (quarter-bpm tempo meta, `bar1` marker, clock-anchor meta) so `inputSha256s` exists on the public build + offline matcher (monotone DP, resync model, IOI windows, verdict schema, hesitation kinds) + attribution (window, priors, note tags, cascade, per-phrase credit) + verdicts as a virtual layer; works on the public build | T2 | SR5, SB7, SC3 |
| SR7 | `exercises` / `attempts` persistence + API (`POST /v1/exercises` writing the `scores` and `exercises` rows in one transaction; `attempts` without soft delete + `void`; `capture` JSON; `exposure`; `POST /v1/ability`); uploads SR6's SMF as the `midi` track of a recording (RC1); matcher run posted as a completed client run (PV1); observation projection with uuid5 ids; `SubjectKind` gains `'exercise'` | T1 | SR6, PV1, RC1, SC4 |
| SR8 | Calibrator v1: continuous θ, graded per-dimension evidence, `nEff` decay, placement, session policy, never-repeat, override, replay; `ability_snapshots` + `GET /v1/ability`; in-memory on the public build | T2 | SR7 |

---

## Deferred (not seeded; listed so nobody re-derives them)

- **Sketchbook phase 2** — collections (`collections`, `collection_items`
  over subjects), fork = new idea + `variant_of` edge, version-tree and
  backlinks views. Re-groom after a month of v1 use.
- **Sketchbook phase 3** (REAPER repo) — bundle → scratch project, "save
  revision" action, `reaper-render` agent. Needs the studio host.
- **MIDI track alongside audio in RC2** — after SB7; one small ticket.
- **Native score attachments on ideas** — a `scores` row linked from the
  idea, never a JSONB column on `idea_assets` (which stays a bytes table);
  sketchbook phase 2, after SC4 *(F1 amendment 2026-09-02)*. SB2 is
  unchanged.
- **`SubjectKind` additions** all use the `kind:<uuid>` string form:
  `'idea'` (SB4), `'score'` (SC4), `'exercise'` (SR7); PV1's
  `extraction_runs.subject_id` is a `str` for the same reason.
- **`pitch-track` extractor** — deferred-able per the recordings doc.
- **Separate worker Deployment** (gitops) — only if the embedded thread in
  PV2 proves inadequate.
- **Retention janitor** for soft-deleted media — sizes do not demand it.
- **Practice-tracking UI wiring** (SessionView → `POST /v1/sessions`,
  StatsView over real sessions) — outside these four docs but the cheapest
  live-deploy win in the repo; one T1 ticket when Nick wants it.

## What is already done (so we don't relitigate)

- Both slots deployed and rolling on push (`docs/deploy-k3s.md`); CI green
  end to end since fix-0003; S3 env and scoped Garage keys delivered to the
  api pod on both slots.
- Backend conventions to mirror: mixins in `models/base.py`, owner-scoped
  repositories, `CamelModel` DTOs, `Page[T]`, problem+json errors,
  `export_openapi.py` → `openapi.json` → `npm run gen:api`.
- Frontend conventions to mirror: `useSavedChords` (gate on
  `backendEnabled`, fetch while active), `api/chords.ts` over the generated
  client, `config.test.ts` proving the public build never assumes a server.
- Verovio plumbing (`toolkit.ts` MEI input, `Score.tsx` callbacks,
  `heatmap.ts`, timemap cursor, `useMetronome`) — the score substrate
  refactors these; nothing needs rebuilding.
- Substrate contract, buckets, DB roles, vault keys — all live (infra
  service-0263 + fix-0219).

## Suggested ordering

Two independent spines run first; the F reviews are the only human step and
they gate only the third and fourth spines.

1. **OPS2** (CI Postgres) — cheap, and every migration after it is proven
   by a round trip instead of by prod.
2. **MD1 → SB1 → SB2** — the media pattern-setter and its first tenant.
   **PV1 → PV2** can run in parallel with SB1/SB2 (the only shared touch is
   the `idea_assets.run_id` FK, owned by whichever lands second).
3. **SB3a → SB3b → PV3** — the inbox is usable and self-describing.
4. **RC1 → RC2 → RC3** (mirrors of SB2/SB3) and **SB4, SB5, SB6, SB7** in
   any order.
5. **PV4** and **RC4** are cross-repo infra tickets with attended deploys —
   claim them in the infra repo when convenient; **PV5** and **RC5** are
   admission-blocked on `deployed` until the services are up, and **RC6**
   follows RC5.
6. **F1, F2** — done 2026-09-02 (docs-0006). **SC1 → SR1 → SR2 → SR5** is
   the shortest path to a playable sight-reading exercise on the public
   build; SC4 and SC2/SC3 can run alongside SR1/SR2 (no shared files), and
   SR6 needs SC3 before it. SR2–SR8 and SC2–SC9 get full criteria when
   SC1/SR1 land and the schema is concrete.
7. **OPS1** — decide, then it is a two-hour ticket.

Loop-eligibility now: OPS2, MD1, PV1, SC1 immediately; SR1 after SC1; SB1
after MD1 is merged; everything else as its deps land — the `**Depends
on:**` line on each ticket is authoritative; this sentence is a summary.
Lines tagged `hardware` are verify notes, never admission inputs. When the
runnable set is exhausted the loop terminates and reports the two
cross-repo deploys and the unseeded provisional rows as what feeds the
next run.

## Notes (dogfooding)

- **FK insert ordering is a Postgres-only failure (found by OPS2, 2026-09-02).**
  There is no `relationship()` anywhere in `app/models/`; the FK is a bare
  column constraint on `OwnedMixin`. SQLAlchemy's unit of work orders
  cross-mapper inserts from ORM relationship dependencies, not column-level
  foreign keys, so a parent and child added to one Session and committed
  together have no guaranteed insert order. SQLite has `PRAGMA foreign_keys`
  OFF and never enforces it; Postgres does. **SB1, PV1 and RC1 all add
  FK-carrying child tables** — any test of theirs that creates parent and
  child in a single `commit()` will pass locally and fail in the
  `test-postgres` step. Flush parents first, or give the models real
  relationships. Only the `integration` suite can catch this.

- Four docs, one grooming doc: the stable-label prefixes (`SB`, `PV`, …)
  are what keep cross-references readable; "Ticket 23" would not have.
- The F-class gate on two spines was the intended shape (a loop faithfully
  implements a wrong spec). It cost one session (docs-0006, 2026-09-02) and
  found, among other things, that Verovio never applies the key signature
  to sounding pitch and never beams MEI input — either would have shipped
  through every gate. The gate was worth it; the pattern stands.
- Cross-repo tickets (PV4, RC4) cannot be dep-checked by this loop; their
  consumers carry a `deployed` criterion against the service so admission
  blocks honestly instead of merging on a mocked green.
- `.tickets/loop.md` predates the `## Runner` / `## Substrates` /
  `## Model routing` template; brought up to date in the same PR as this doc.
