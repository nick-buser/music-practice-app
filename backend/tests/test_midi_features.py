"""`midi-features@1.0.0` tests (PV3). See `.tickets/_grooming-sketchbook-and-media.md`'s
PV3 entry for the acceptance criterion this file proves: three fixture MIDI
files (a C major scale, an A minor arpeggio, a chromatic run) yield the
expected `key_guess`, `note_count`, and a `pitch_class_histogram` summing
to 1 ± 1e-6.

Every fixture is built here with `mido` at test time (no binary fixtures
committed — PV3's own instruction) and fed straight to `MidiFeatures().run`
via a hand-built `ExtractorContext` over a `MemoryMediaStore` — this
exercises the extractor's actual computation in isolation, independent of
the enqueue/worker/DB plumbing (`test_idea_assets.py` covers the
auto-enqueue side of PV3; `test_worker.py` already covers claim→execute→write
generically via `sha256-echo`).
"""

from __future__ import annotations

import io
import math

import mido
import pytest

from app.jobs.extractors.midi_features import DEFAULT_TEMPO_BPM, MidiFeatures
from app.jobs.registry import AssetOut, ExtractorContext, PropertyOut
from app.models.provenance import ExtractionRun
from app.storage import MemoryMediaStore

# C4 = 60 (MIDI note numbers), matching `midi_features.py`'s own convention.
_C4, _D4, _E4, _F4, _G4, _A4, _B4 = 60, 62, 64, 65, 67, 69, 71
_A3 = 57


def _quarter_notes(pitches: list[int], *, tempo: int | None) -> bytes:
    """Build a single-track SMF: `pitches` played back-to-back as quarter
    notes (480 ticks — mido's own default `ticks_per_beat`), each ending
    exactly when the next begins, so every fixture built this way has a
    mean polyphony of exactly 1.0 regardless of note count and no silence
    to pad `duration_ms`. `tempo` (microseconds per beat) is emitted as a
    `set_tempo` meta message before the first note when given; omitted
    entirely to exercise the "no tempo meta" → `DEFAULT_TEMPO_BPM` fallback.
    """
    mid = mido.MidiFile()
    track = mido.MidiTrack()
    mid.tracks.append(track)
    if tempo is not None:
        track.append(mido.MetaMessage("set_tempo", tempo=tempo, time=0))
    for pitch in pitches:
        track.append(mido.Message("note_on", note=pitch, velocity=64, time=0))
        track.append(mido.Message("note_off", note=pitch, velocity=64, time=480))
    buf = io.BytesIO()
    mid.save(file=buf)
    return buf.getvalue()


def _context_for(payload: bytes, store: MemoryMediaStore) -> ExtractorContext:
    blob = store.put_stream(io.BytesIO(payload), "audio/midi")
    # Never persisted (no `db.add`/flush) — the extractor only ever reads
    # `run.input_sha256s`, so a bare in-memory `ExtractionRun` is enough to
    # satisfy `ExtractorContext`'s type without any DB round trip.
    run = ExtractionRun(
        subject_kind="idea",
        subject_id="idea:test-subject",
        input_sha256s=[blob.sha256],
        extractor=MidiFeatures.name,
        extractor_version=MidiFeatures.version,
        executor="worker",
        params={},
        params_hash="test",
        status="queued",
    )
    return ExtractorContext(run=run, store=store)


def _properties_by_kind(
    results: list[PropertyOut | AssetOut],
) -> dict[str, PropertyOut]:
    by_kind: dict[str, PropertyOut] = {}
    for r in results:
        assert isinstance(r, PropertyOut), f"midi-features returned a non-property result: {r!r}"
        assert r.kind not in by_kind, f"duplicate property kind {r.kind!r}"
        by_kind[r.kind] = r
    return by_kind


@pytest.fixture
def store() -> MemoryMediaStore:
    return MemoryMediaStore()


# ─── C major scale: a clean, unambiguous major-key histogram ────────────


def test_c_major_scale_yields_c_major_with_expected_note_count_and_histogram(
    store: MemoryMediaStore,
) -> None:
    payload = _quarter_notes([_C4, _D4, _E4, _F4, _G4, _A4, _B4], tempo=600_000)  # 100 bpm
    ctx = _context_for(payload, store)

    props = _properties_by_kind(MidiFeatures().run(ctx))

    assert props["note_count"].payload == {"count": 7}
    assert props["tempo"].payload == {"bpm": 100}  # first (and only) tempo meta
    assert props["duration_ms"].payload["durationMs"] == pytest.approx(4200, abs=1)

    histogram = props["pitch_class_histogram"].payload["histogram"]
    assert len(histogram) == 12
    assert sum(histogram) == pytest.approx(1.0, abs=1e-6)
    # Every diatonic degree of C major gets equal weight (one quarter note
    # each); every chromatic (non-scale) pitch class is silent.
    diatonic_pitch_classes = {0: 1 / 7, 2: 1 / 7, 4: 1 / 7, 5: 1 / 7, 7: 1 / 7, 9: 1 / 7, 11: 1 / 7}
    for pc, expected in diatonic_pitch_classes.items():
        assert histogram[pc] == pytest.approx(expected, abs=1e-9)
    for pc in (1, 3, 6, 8, 10):
        assert histogram[pc] == pytest.approx(0.0, abs=1e-9)

    key_guess = props["key_guess"]
    assert key_guess.payload == {"key": "C major"}
    assert key_guess.confidence == pytest.approx(0.7564070930899865, abs=1e-9)

    roll = props["piano_roll_summary"].payload
    assert roll == {"lowestPitch": _C4, "highestPitch": _B4, "meanPolyphony": pytest.approx(1.0)}


# ─── A minor arpeggio: a minor-triad-weighted histogram ──────────────────


def test_a_minor_arpeggio_yields_a_minor_with_no_tempo_meta_defaulting_to_120(
    store: MemoryMediaStore,
) -> None:
    # A3 C4 E4 A4 E4 C4 A3 — the tonic (A) sounds three times, C and E twice
    # each, exactly what a played-and-released arpeggio naturally does.
    payload = _quarter_notes([_A3, _C4, _E4, 69, _E4, _C4, _A3], tempo=None)
    ctx = _context_for(payload, store)

    props = _properties_by_kind(MidiFeatures().run(ctx))

    assert props["note_count"].payload == {"count": 7}
    assert props["tempo"].payload == {"bpm": DEFAULT_TEMPO_BPM}  # no set_tempo in this fixture
    assert props["duration_ms"].payload["durationMs"] == pytest.approx(3500, abs=1)

    histogram = props["pitch_class_histogram"].payload["histogram"]
    assert sum(histogram) == pytest.approx(1.0, abs=1e-6)
    assert histogram[9] == pytest.approx(3 / 7, abs=1e-9)  # A
    assert histogram[0] == pytest.approx(2 / 7, abs=1e-9)  # C
    assert histogram[4] == pytest.approx(2 / 7, abs=1e-9)  # E

    key_guess = props["key_guess"]
    assert key_guess.payload == {"key": "A minor"}
    assert key_guess.confidence == pytest.approx(0.9239689095875607, abs=1e-9)
    # The minor-triad histogram correlates more strongly with A minor's
    # profile than the C major scale fixture's diatonic-seven histogram
    # does with C major's — a tighter, more tonic-weighted set of pitch
    # classes is a stronger signal either way.
    assert key_guess.confidence is not None
    assert key_guess.confidence > 0.9


# ─── chromatic run: a flat histogram is a weak (not fabricated) guess ────


def test_chromatic_run_has_a_flat_histogram_and_a_visibly_weak_confidence(
    store: MemoryMediaStore,
) -> None:
    chromatic = list(range(_C4, _C4 + 12))  # 12 consecutive semitones
    payload = _quarter_notes(chromatic, tempo=500_000)
    ctx = _context_for(payload, store)

    props = _properties_by_kind(MidiFeatures().run(ctx))

    assert props["note_count"].payload == {"count": 12}

    histogram = props["pitch_class_histogram"].payload["histogram"]
    assert sum(histogram) == pytest.approx(1.0, abs=1e-6)
    for weight in histogram:
        assert weight == pytest.approx(1 / 12, abs=1e-9)

    key_guess = props["key_guess"]
    assert key_guess.confidence is not None
    # A perfectly flat histogram has zero variance and therefore correlates
    # with nothing (see `_pearson_correlation`'s docstring) — the guess
    # still names *a* key (ties resolve deterministically), but its
    # confidence is exactly the "no signal" value, not a fabricated high
    # number.
    assert key_guess.confidence == pytest.approx(0.0, abs=1e-9)
    assert math.isclose(key_guess.confidence, 0.0, abs_tol=1e-9)


# ─── an empty/note-less MIDI file: no fabricated key ─────────────────────


def test_a_note_less_midi_file_reports_no_key_guess_or_histogram(store: MemoryMediaStore) -> None:
    # A tempo-only file: legal SMF, zero notes.
    mid = mido.MidiFile()
    track = mido.MidiTrack()
    track.append(mido.MetaMessage("set_tempo", tempo=500_000, time=0))
    mid.tracks.append(track)
    buf = io.BytesIO()
    mid.save(file=buf)
    ctx = _context_for(buf.getvalue(), store)

    props = _properties_by_kind(MidiFeatures().run(ctx))

    # No pitch content to summarise — correlating an all-zero vector is
    # undefined, so this extractor reports no key_guess/histogram at all
    # rather than a fabricated one (see `MidiFeatures.run`'s comment).
    assert "key_guess" not in props
    assert "pitch_class_histogram" not in props

    # Every other fact is still reported.
    assert props["note_count"].payload == {"count": 0}
    assert props["tempo"].payload == {"bpm": 120}
    assert props["piano_roll_summary"].payload == {
        "lowestPitch": None,
        "highestPitch": None,
        "meanPolyphony": 0.0,
    }


def test_run_raises_a_clear_error_when_the_run_has_no_input_hashes(store: MemoryMediaStore) -> None:
    run = ExtractionRun(
        subject_kind="idea",
        subject_id="idea:test-subject",
        input_sha256s=[],
        extractor=MidiFeatures.name,
        extractor_version=MidiFeatures.version,
        executor="worker",
        params={},
        params_hash="test",
        status="queued",
    )
    ctx = ExtractorContext(run=run, store=store)
    with pytest.raises(ValueError, match="requires at least one input"):
        MidiFeatures().run(ctx)
