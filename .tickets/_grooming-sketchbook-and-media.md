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

### F1 — Adversarial review of the ScoreDoc model and the anchor/annotation contract
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
- [ ] Amendments committed to `docs/score-substrate.md` with a "Reviewed
      YYYY-MM-DD (F1)" line — human-ratified (substrate: H)
- [ ] SC1's scope updated here to match, and its `[not seeded]` mark removed

### F2 — Adversarial review of the technique taxonomy, rung ladders, level presets, and attribution rules
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
- [ ] Amendments committed to `docs/sight-reading-generation.md` with a
      "Reviewed YYYY-MM-DD (F2)" line — human-ratified (substrate: H)
- [ ] SR1's scope updated here to match, and its `[not seeded]` mark removed

**Decision needed (Nick, at any time):** dispatch F1 and F2, or waive one
and seed its spine at T3 as designed. Until decided, the SC and SR spines
stay `[not seeded]` and the loop reports them as such when it runs dry.

---

## Media plumbing

### MD1 — Garage media store: settings, content-addressed keys, streaming upload with sha256, health probe
**Tier:** T2 (storage pattern-setter; the donor for SB2 and RC1)
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
- Migration `0002_ideas`; `openapi.json` + `schema.d.ts` regenerated.
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
**Why:** Attachments are what make an idea more than a note; this is the
first real bytes-through-Garage path.
**Scope / surfaces / files:**
- `backend/app/models/idea.py`: `IdeaAsset` (`idea_id`, `revision` int ≥ 1,
  `role` enum per the doc, `filename`, `storage_key`, `mime`, `bytes`,
  `sha256`, `run_id?` uuid — plain column now, FK added in PV1; mixins).
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
- Migration `0003_idea_assets`; contract regenerated.
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
**Why:** Small and high value once there are more ideas than fit on a screen.
**Scope / surfaces / files:**
- `backend/app/search.py`: pure `parse_query(q) -> ParsedQuery` for
  `tag:x kind:y key:z status:s` tokens plus free text (unit-tested).
- Migration `0004_ideas_search`: Postgres-only generated `search_tsv`
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
**Why:** Ten seconds of noodling into the inbox, no DAW. This is the capture
path the studio machine cannot replace.
**Scope / surfaces / files:**
- `app/src/midi/access.ts`: `useMidiInputs()` over
  `navigator.requestMIDIAccess` (feature-detected; absent → the UI hides the
  button), device list, `onMessage` subscription.
- `app/src/midi/recorder.ts`: pure `MidiRecorder` collecting note on/off +
  timestamps from a `MIDIMessageEvent` stream; `stop()` returns events.
- `app/src/midi/smf.ts`: pure Standard MIDI File type-0 encoder (tempo
  meta 120 bpm, PPQ 480, variable-length deltas) — unit-tested against
  known byte sequences; no new dependency.
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
**Why:** "Every derived datum names its producer." Nothing derived may exist
before these tables do; SB2 already reserves `run_id`.
**Scope / surfaces / files:**
- `backend/app/models/provenance.py`: `ExtractionRun` (`subject_kind`,
  `subject_id` uuid, `input_sha256s` JSON list, `extractor`,
  `extractor_version`, `model_ref?`, `params` JSON, `params_hash`, `status`
  enum `queued|running|succeeded|failed`, `started_at?`, `finished_at?`,
  `error?`, mixins; unique `(subject_kind, subject_id, extractor,
  extractor_version, params_hash)`) and `ExtractedProperty` (`run_id` FK,
  `kind`, `time_range?` JSON, `payload` JSON, `confidence?`).
- `backend/app/provenance.py`: `canonical_params_hash(params)` = sha256 of
  sorted-keys compact JSON; `latest_properties(db, subject)` = newest
  succeeded run per `(extractor, kind)`.
- Migration `0005_provenance` also adds the FK `idea_assets.run_id →
  extraction_runs.id`.
- Routes: `POST /v1/runs` (enqueue; returns the existing row with 200 on an
  idempotent hit, 201 otherwise), `GET /v1/runs/{id}`,
  `GET /v1/subjects/{kind}/{id}/properties` (latest per kind, each with
  `run` lineage inline), `GET /v1/subjects/{kind}/{id}/runs`.
**Acceptance criteria:**
- [ ] Same params in different key order hash identically; a changed value
      changes the hash — `tests/test_provenance.py` (substrate: unit)
- [ ] Enqueuing twice with identical inputs returns the same run id; runs
      are never updated in place by the API (patch is not exposed)
      (substrate: unit)
- [ ] With two succeeded runs of one extractor, `properties` returns only
      the newer run's property per kind and both remain in `runs`
      (substrate: unit)
- [ ] Gates green; contract regenerated (substrate: unit)
- [ ] After merge, the migrate Job completes on both slots (substrate: deployed)

### PV2 — Job worker: queued runs → extractor registry → properties, embedded in the api process
**Tier:** T2 (the app's first background execution path)
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
**Why:** The tables the capture UI, the extractors, and tempo-vs-target
all hang on.
**Scope / surfaces / files:**
- `backend/app/models/recording.py`: `Recording` (`subject_kind`,
  `subject_id` str — matches `practice_sessions.subject_id`, `session_id?`
  FK, `captured_at`, `duration_ms?`, `notes?`, mixins) and `RecordingTrack`
  (`recording_id`, `kind` enum `audio|midi`, `storage_key`, `mime`,
  `bytes`, `sha256`, mixins).
- Routes: `POST /v1/recordings`, `GET /v1/recordings?subjectKind=&subjectId=`
  (newest first), `GET /v1/recordings/{id}`, `PATCH` (notes,
  duration), `DELETE` (soft), `POST /v1/recordings/{id}/tracks` multipart,
  `GET .../tracks/{id}/content` streaming.
- Migration `0006_recordings`; contract regenerated.
**Acceptance criteria:**
- [ ] Create + upload an audio track → sha256 matches, listing by subject
      returns it newest first, content streams back byte-identical —
      `tests/test_recordings.py` (substrate: unit)
- [ ] Gates green; contract regenerated (substrate: unit)
- [ ] After merge, migrate Job green on both slots and a `curl` round trip
      on the dev slot succeeds (substrate: deployed)

### RC2 — Capture UI: MediaRecorder in SessionView, takes list with playback
**Tier:** T2 (first `getUserMedia` surface)
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

### OPS2 — Real-Postgres backend tests in CI
**Tier:** T1
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

## Score substrate  `[not seeded until F1 lands — provisional]`

Listed so the plan is visible and dependencies are honest; full acceptance
criteria are written after F1 amends the model. Do not claim these.

| Label | Title | Tier | Depends on |
|---|---|---|---|
| SC1 | ScoreDoc zod schema + `toMei()` deterministic serializer + snapshot tests + `renderScoreDoc` through `inputFrom: 'mei'` with `xml:id` passthrough verified | T3 | F1 |
| SC2 | ScoreSurface stack: Engraving / Annotation / Interaction / Cursor layers refactored out of `Score.tsx`, `heatmap.ts`, `SessionScore.tsx`; selection model | T2 | SC1 |
| SC3 | Anchor resolution + overlay renderer (`elements`, `measureRange`, `region`) with orphan detection | T2 | SC2 |
| SC4 | Annotations + layers persistence: backend tables (target, layer, anchor JSON, body JSON, author user/system+runId), API, migration | T1 | F1 |
| SC5 | Client wiring: annotation tools (text, highlight, symbol) over SC3 persisted via SC4; recordings get `timeRange` anchors (this is RC7) | T1 | SC3, SC4, RC6 |
| SC6 | Section heatmap → a system layer | T0 | SC5 |
| SC8 | MusicXML → ScoreDoc importer (native subset), promotion path | T2 | SC1 |
| SC9 | E1 structured entry: cursor + duration palette + MIDI step entry over SB7's hook | T2 | SC2, SB7 |

## Sight-reading  `[not seeded until F2 lands — provisional]`

Top product priority. Gated only by F2 (one review session), then SC1.

| Label | Title | Tier | Depends on |
|---|---|---|---|
| SR1 | Taxonomy module (`app/src/generation/taxonomy.ts`) + scorer: features → rungs per dimension, per-measure ceiling enforcement, hand-scored fixtures pinning every rung boundary | T3 | F2, SC1 |
| SR2 | Generator thin slice: seeded PRNG, harmonic skeleton, RH-only single line at the lowest rungs, legality pass, scorer verify loop; recipe fixtures pin exact output | T3 | SR1 |
| SR3 | Generator breadth: LH pattern classes, `hands.together` ratios, full rhythm grammars, re-roll + logged relaxation | T3 | SR2 |
| SR5 | Exercise player view: generate → ScoreSurface → metronome count-in → self-report; works on the public build (ephemeral), nav entry, `config.test.ts` discipline | T2 | SR2, SC2 |
| SR6 | Web MIDI capture + matcher (pure TS, versioned) + verdicts as a system annotation layer; raw MIDI log kept | T2 | SR5, SB7, SC5 |
| SR7 | `exercises` / `attempts` persistence + API (recipe + ScoreDoc + feature vector; attempts with uuid5 ids and matcher/scorer versions; verdicts recorded as a run with producer `midi-matcher@<v>`) | T1 | SR2, PV1 |
| SR8 | Calibrator v1: per-dimension ability from attempts (Elo-lite), session policy, manual override, `ability_snapshots` | T2 | SR6, SR7 |

---

## Deferred (not seeded; listed so nobody re-derives them)

- **Sketchbook phase 2** — collections (`collections`, `collection_items`
  over subjects), fork = new idea + `variant_of` edge, version-tree and
  backlinks views. Re-groom after a month of v1 use.
- **Sketchbook phase 3** (REAPER repo) — bundle → scratch project, "save
  revision" action, `reaper-render` agent. Needs the studio host.
- **MIDI track alongside audio in RC2** — after SB7; one small ticket.
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
   **PV1 → PV2** can run in parallel with SB1/SB2 (no shared files).
3. **SB3a → SB3b → PV3** — the inbox is usable and self-describing.
4. **RC1 → RC2 → RC3** (mirrors of SB2/SB3) and **SB4, SB5, SB6, SB7** in
   any order.
5. **PV4** and **RC4** are cross-repo infra tickets with attended deploys —
   claim them in the infra repo when convenient; **PV5** and **RC5** are
   admission-blocked on `deployed` until the services are up, and **RC6**
   follows RC5.
6. **F1, F2** — Nick dispatches. Then re-groom SC and SR into full tickets
   (SC1 and SR1 first; SR2 is the thin slice that makes sight-reading real).
7. **OPS1** — decide, then it is a two-hour ticket.

Loop-eligibility now: OPS2, MD1, PV1 immediately; SB1 after MD1 is merged;
everything else as its deps land. When the runnable set is exhausted the
loop terminates and reports the F decisions and the two cross-repo deploys
as what feeds the next run.

## Notes (dogfooding)

- Four docs, one grooming doc: the stable-label prefixes (`SB`, `PV`, …)
  are what keep cross-references readable; "Ticket 23" would not have.
- The F-class gate on two spines is the intended shape (a loop faithfully
  implements a wrong spec), but it means the top product priority waits on
  one human session. Surface that loudly in every status report.
- Cross-repo tickets (PV4, RC4) cannot be dep-checked by this loop; their
  consumers carry a `deployed` criterion against the service so admission
  blocks honestly instead of merging on a mocked green.
- `.tickets/loop.md` predates the `## Runner` / `## Substrates` /
  `## Model routing` template; brought up to date in the same PR as this doc.
