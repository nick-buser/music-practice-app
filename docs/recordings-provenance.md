# Practice recordings: capture, storage, annotation, provenance

The practice-tracking workstream wants periodic recordings of pieces being
worked on — with annotation layers, notes, tempo-vs-target, and extracted
properties. The dangerous phrase is "extracted properties": the moment a
machine writes "this take was at 92 bpm" into the database, you either know
exactly which machine, which version, and which inputs said so — or you have
unaccountable data that can never be trusted, corrected, or recomputed.

So this doc's spine is a provenance rule, stated once and applied to
everything derived:

> **Raw is immortal. Derived is recomputable. Every derived datum names its
> producer.**

Companion docs: annotations here reuse the anchor/layer model from
[score-substrate.md](score-substrate.md) (with time anchors instead of
element anchors); MIDI assessment in
[sight-reading-generation.md](sight-reading-generation.md) conforms to the
extraction contract defined here.

## Capture

- **Audio**: `MediaRecorder` in the browser — `audio/webm;codecs=opus` on
  Chrome desktop (the primary device; Safari's mp4/aac shape is a foreign
  citizen we accept but don't chase in v1). Nothing today uses
  `getUserMedia`; this is net-new surface, and the SessionView "recording"
  badge finally becomes real.
- **MIDI**: optionally captured in parallel (same Web MIDI machinery as
  sight-reading assessment). A recording has **tracks** — audio, MIDI, or
  both. A MIDI track is small, lossless ground truth; when present it makes
  most audio extraction unnecessary for that take.
- **Subject**: every recording is *of* something — a piece, a generated
  exercise, or free practice — via the existing `subject` convention
  (`data/subject.ts`, `practice_sessions.subject_id`), and optionally
  *within* a practice session (FK to `practice_sessions`).
- **Periodic**: a per-piece cadence setting ("record this weekly") computed
  into a due/overdue state client-side and surfaced in the session UI. No
  scheduler service, no notifications — deliberately not yet.

## Storage

Bytes go to **Garage** — the `soundings-{dev,prod}` buckets with per-env
scoped keys already provisioned by the substrate contract (infra
service-0263); personal media is exactly why those keys are scoped off the
shared grant loop. The laptop never processes media (disk discipline);
the backend and mlserve do.

Upload path v1: client → API (multipart) → backend streams to Garage.
API-mediated rather than presigned URLs, deliberately: single-tenant means
no fan-out pressure, custody of the scoped keys stays server-side, and
every write is auditable in one place. Presigned uploads are the named
escape hatch if takes ever get big enough to care (video).

```
recordings {
  id, user_id, subject_kind?, subject_id?, session_id?,   -- both subject columns NULL for free practice
                                                          -- and sketchbook voice captures (an inbox item)
  captured_at, duration_ms, cadence-due bookkeeping,
  + standard mixins (client-mintable UUID, timestamps, soft delete)
}
recording_tracks {
  id, recording_id, kind: audio|midi,
  storage_key, mime, bytes, sha256,
  offset_ms             -- track start − recordings.captured_at (F1 amendment 2026-09-02):
                        -- audio = MediaRecorder start; MIDI = first count-in click or first event
}
```

**The recording clock** is the recording's own timeline: t = 0 is
`captured_at`; every track carries its `offset_ms`, so a track-local time
converts by adding it. `timeRange` anchors and every property `time_range`
are on the recording clock — otherwise an audio take and a MIDI take of the
same attempt disagree by an unknown offset the moment two tracks exist. A
recording may be MIDI-only (a sight-reading attempt is one).

`sha256` on every track: integrity, dedup, and the root of the provenance
chain — every extraction names inputs whose hashes pin what it actually saw.

Size reality check: opus at ~1 MB/min means even years of near-daily takes
is single-digit GB. Garage shrugs. No lifecycle/retention policy in v1;
soft-deleted recordings keep their bytes until a future janitor ticket.

## The provenance contract

Two tables carry the whole rule:

```
extraction_runs {
  id, subject_kind, subject_id (str, the house subject form — see below),
  input_sha256s jsonb,  -- sorted; the server folds it into params before hashing
  extractor,            -- 'beat-tracker', 'pitch-track', 'midi-matcher', ...
  extractor_version,    -- semver of the code that ran
  model_ref?,           -- weights identifier when one is involved
  executor: worker|client|external,
  params jsonb,         -- canonicalized (sorted keys) before hashing
  params_hash,
  status: queued|running|succeeded|failed, started_at, finished_at, error?
}
extracted_properties {
  id, run_id,           -- exactly one producing run, always
  kind,                 -- 'tempo_curve', 'onsets', 'pitch_track', 'loudness',
                        -- 'waveform_peaks', 'alignment_map', ...
  time_range?,          -- when the property covers a span, not the whole take
  payload jsonb,
  confidence?
}
```

The rules that make it a contract rather than a schema:

- **Every extracted property references exactly one run.** No orphaned
  numbers, ever. The UI always shows lineage: "tempo curve — beat-tracker
  v0.3 · Jul 12 take."
- **Runs are immutable.** Re-extraction is a *new* run; nothing derived is
  edited in place.
- **Idempotency is structural**: unique on `(subject_kind, subject_id,
  extractor, extractor_version, params_hash)`, where the **server** folds
  the sorted `input_sha256s` into `params.inputSha256s` before hashing
  (clients never include it themselves), so two different inputs of one
  subject never collide. Asking twice for the same extraction is a cache
  hit, not a duplicate.
- **Superseding is a view, not a delete**: the newest succeeded run per
  `(extractor, kind)` is the default read; older runs remain for
  comparison and time-travel. Rows are cheap; trust is not.
- **Runs are keyed by subject, not by recording** *(amendment 2026-08-29,
  [sketchbook.md](sketchbook.md))*: `extraction_runs.recording_id` becomes
  `(subject_kind, subject_id)` plus `input_sha256s`, so the same two tables
  serve recordings, sketchbook idea assets (MIDI features, rendered
  previews), and whatever comes next. A derived *file* (a FluidSynth or
  REAPER render) is an asset row carrying a `run_id`, the same lineage as a
  jsonb property. `subject_id` is a **string** in the house subject form
  (`recording:<uuid>`, `idea:<uuid>`, `score:<uuid>`, `exercise:<uuid>`),
  matching `practice_sessions.subject_id` — never a uuid column *(F1
  amendment 2026-09-02; applies to PV1)*.
- **The MIDI matcher is an extractor.** Sight-reading verdicts are
  extracted properties (`attempt_verdicts`, plus `alignment_map`) of the
  attempt's recording — `input_sha256s = [midiTrack.sha256, scoreDocHash]`,
  `params = { exerciseId, scoreDocHash, matcher settings }`, never the
  ScoreDoc body — one contract for every machine-derived datum in the app.
  Verdicts are **recomputable** when the matcher improves (a new run), not
  recomputed for free: the matcher runs in the browser (next bullet), so
  recompute is client-driven, lazily on open or in bulk *(F2 amendment)*.
- **Producers may be browser-side or external.** `extraction_runs` carries
  `executor: 'worker' | 'client' | 'external'`. Worker runs are enqueued and
  executed by the job worker. Client runs are executed by pure-TS
  extractors in the browser and **posted complete**: `POST /v1/runs`
  accepts `{ subjectKind, subjectId, extractor, extractorVersion, params,
  inputSha256s, executor: 'client', status: 'succeeded' | 'failed', error?,
  properties: [...] }` and inserts the run and its properties in one
  transaction; the same unique key applies and an idempotent hit returns
  the existing run and discards the posted properties; the server
  allowlists client extractors (`midi-matcher`, `scorer`,
  `musicxml-import` — all pure TS) and rejects worker-only names.
  `external` is the same posted-complete shape for imported producers
  (`reaper-capture-sidecar`). The contract is about lineage
  and idempotency, not about where the CPU is *(F2 amendment 2026-09-02;
  applies to PV1)*.

## Extraction: mlserve, behind the job boundary

Extractors run on the homelab GPU box (`mlserve`), which already hosts
exactly this shape of service — small FastAPI wrappers under systemd
(kokoro-tts, faster-whisper, YOLO11, bge-reranker). Audio analysis joins
the fleet as one more service; the laptop is never in the loop for audio
extractors (the browser-side MIDI matcher is the exception, above).

The backend keeps its promise from `backend/README.md` — heavy work is
**enqueue→poll, never inline**: a `POST` creates the `extraction_run` row
as `queued` and returns; a worker drives it against mlserve and lands
properties; clients poll run status. The jobs mechanism this introduces is
the app's first, and it's deliberately the thinnest thing that works (a
worker loop over queued runs — no broker until proven necessary).

v1 extractor set, chosen for the tempo-vs-target product goal:

| Extractor | Property kinds | Notes |
|---|---|---|
| `beat-tracker` | `tempo_curve`, `onsets` | librosa/madmom class; the tempo-vs-target backbone |
| `loudness` | `loudness` | LUFS-ish envelope; dynamics over time |
| `waveform-peaks` | `waveform_peaks` | so the client draws waveforms without downloading audio |
| `pitch-track` | `pitch_track` | basic-pitch/CREPE class; deferred-able if scope needs cutting |
| `midi-matcher` | `attempt_verdicts`, `alignment_map` | pure TS in the browser (`app/src/midi/matcher.ts`), posted as a completed client run; defined in the sight-reading doc |

## Annotation layers on recordings

The annotation/layer model is the substrate doc's, verbatim — the only
difference is the anchor: `{ kind: 'timeRange', startMs, endMs, trackId? }`
on the recording clock against a recording instead of element ids against
a score. Text notes at timestamps and highlighted passages are user
annotation rows through the same tables and toggle UI. Machine marks —
tempo curves, loudness, verdicts — are **virtual system layers**:
projected at read time from the newest succeeded run's property, never
written to `annotations`, so supersession is the provenance rule and a
recompute never doubles rows *(F1 amendment 2026-09-02)*. Human marks carry
a user; machine marks carry the `runId` of the property they were projected
from.

**Tempo-vs-target** — the headline feature of this workstream — is a
*view*, not stored data: the `tempo_curve` property plotted against the
session's target bpm (`practice_sessions.bpm`). It recomputes when either
side changes, and it carries its lineage badge like everything derived.

## Score↔audio alignment: the bridge, staged

Eventually annotations should cross the bridge — click a rough passage in
the waveform, see the measures; click a measure, hear your takes of it.
The design makes that a *pure addition*:

- An **alignment is just another extraction run** producing an
  `alignment_map` property (score-time ↔ audio-time correspondence).
- When an alignment exists, `timeRange` anchors project onto the
  substrate's `scoreTime` anchor (exact quarter-note positions, defined
  there from day one) and vice versa. No schema changes — a resolver gains
  one lookup. `alignment_map.payload` is `{ scoreId, scoreDocHash, points:
  [{ q: Fraction, ms }] }`, monotone in both fields, `ms` on the recording
  clock.
- **MIDI tracks of generated exercises get alignment for free**: the
  matcher run emits `alignment_map` from its matched onsets. Audio-only
  takes of repertoire need real score-following/DTW on mlserve — genuinely
  hard, explicitly deferred.

v1 ships without alignment, and loses nothing by it: time-anchored
annotations and tempo-vs-target don't need it.

## Two shapes and privacy

Recordings are personal media and exist **only** in the homelab shape —
every surface here gates on `backendEnabled`
([DEPLOYMENT.md](../DEPLOYMENT.md)); the public build persists none of it,
per the showcase-isolation rule (the browser-side matcher still runs there,
in memory, with no recording created). Bytes live in scoped-key buckets no other
tenant's key can list. No sharing/export features in v1.

## Design decisions worth knowing

- **Raw immortal / derived recomputable / producers named** — the spine;
  every other choice serves it.
- **Tracks, not files**: a recording is one practice event with 1..n
  tracks; audio+MIDI takes stay one thing.
- **API-mediated upload** over presigned URLs — custody and auditability
  beat theoretical throughput at single-tenant scale.
- **The thinnest job runner that works** — a worker over `extraction_runs`
  rows; no Redis/broker until a real queue-pressure problem exists.
- **Nothing derived is a belief**: tempo curves and verdicts are
  observations with lineage; interpretations (ability estimates, "improving"
  judgments) live app-side, recomputable, and — per the standing crucible
  rule — observations are exportable to the evidence log later (stable
  uuid5 ids), beliefs never are.

## Deliberately not yet

- **Video** — the model (`tracks.kind`) admits it; capture/UI don't chase it.
- **Audio→score alignment** — the bridge is designed (one new property
  kind), not built.
- **Retention/lifecycle policy** — sizes don't demand it yet.
- **Sharing, export, multi-device sync** — single-tenant, one primary
  device.
- **A real queue/broker** — earned by evidence, not anticipation.

## Implementation seeds (for grooming)

| Seed | Scope | Tier |
|---|---|---|
| Garage media plumbing (S3 client, buckets config, streaming upload, sha256) | storage pattern-setter | T2 |
| Recordings/tracks schema + CRUD + capture UI (MediaRecorder + MIDI) | makes the badge real | T2 |
| Provenance tables + run lifecycle + idempotency key | this doc's contract, in Alembic | T2 |
| Job worker (queued runs → mlserve → properties) | thinnest-that-works | T2 |
| mlserve audio-extractor service (beat/loudness/peaks) | homelab repo, mirrors existing services | T2 |
| Per-extractor additions after the first | mirrors | T1 |
| Recording view: waveform + time-anchored annotations + tempo-vs-target | consumes layers + properties | T2 |
| Cadence setting + due state | small product logic | T1 |
