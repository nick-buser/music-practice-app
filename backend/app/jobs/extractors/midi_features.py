"""`midi-features@1.0.0` — PV3's first real extractor: turns a captured
`.mid`/`.midi` asset into six independent facts (key guess, tempo, note
count, pitch-class histogram, duration, piano-roll summary), each its own
`PropertyOut` (see that dataclass's docstring in `app/jobs/registry.py`) so
a later extractor can supersede one kind without disturbing the rest.

Mirrors `Sha256Echo`'s shape: a stateless class with `name`/`version` class
attributes and a `run(ctx)` method, registered at the bottom of this
module. `app/jobs/extractors/__init__.py` imports this module so the
registration actually happens — see that file's docstring for why
something has to.
"""

from __future__ import annotations

import io
import math
from typing import Any, NamedTuple

import mido

from app.jobs.registry import AssetOut, ExtractorContext, PropertyOut, register

# ─── Krumhansl-Schmuckler key-finding ────────────────────────────────────
#
# Krumhansl & Kessler's (1982) probe-tone key-profile ratings, as tabulated
# in Krumhansl, C. L. (1990) *Cognitive Foundations of Musical Pitch*,
# Oxford University Press, Table 3.1 — the standard "K-S profile" the
# textbook key-finding algorithm correlates a piece's pitch-class
# distribution against. Index 0 is the tonic; index i is the profile's
# weight for the pitch class i semitones above the tonic.
_MAJOR_PROFILE: tuple[float, ...] = (
    6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
)
_MINOR_PROFILE: tuple[float, ...] = (
    6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
)

# Sharps only, matching the grooming doc's own lineage-badge example
# ("key guess: F♯ minor …") — flats are an equally valid spelling but this
# extractor picks one and stays consistent with it, per PV3's design notes.
_NOTE_NAMES: tuple[str, ...] = ("C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B")

# "tempo (first tempo meta or 120)" — PV3's scope line. Standard-MIDI-File's
# own implicit default absent any `set_tempo` meta message is 120 bpm
# (500,000 µs/beat), which is also what a human calls "no tempo info" for a
# short capture, so it doubles as this extractor's fallback.
DEFAULT_TEMPO_BPM = 120
_DEFAULT_TEMPO_USEC_PER_BEAT = 500_000


def _pearson_correlation(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    """Pearson's r between two equal-length vectors.

    Returns `0.0` — not a raised `ZeroDivisionError`, not `nan` — when
    either vector has zero variance. A perfectly flat pitch-class histogram
    (the chromatic-run fixture: every pitch class equally represented) has
    zero variance and therefore correlates with *nothing*; `0.0` is exactly
    the "this guess carries no signal" value `_guess_key`'s `confidence`
    needs it to be, rather than a NaN that would poison every downstream
    comparison silently.
    """
    n = len(a)
    mean_a = sum(a) / n
    mean_b = sum(b) / n
    numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b, strict=True))
    spread_a = math.sqrt(sum((x - mean_a) ** 2 for x in a))
    spread_b = math.sqrt(sum((y - mean_b) ** 2 for y in b))
    if spread_a == 0.0 or spread_b == 0.0:
        return 0.0
    return numerator / (spread_a * spread_b)


def _guess_key(histogram: tuple[float, ...]) -> tuple[str, float]:
    """Correlate `histogram` against the K-S major/minor profile at all 12
    rotations (24 candidates total); the best-correlating (tonic, mode)
    names the key, and that best correlation *is* the confidence.

    This is the judgment call PV3 asks not to hide: a weak/ambiguous
    histogram doesn't get a differently-computed "uncertain" marker, it
    gets the *same* correlation-strength number a strong guess gets — a
    caller (the properties panel) reads low `confidence` as "don't trust
    this" rather than this function silently declining to answer. Ties
    (multiple candidates at the same best correlation — e.g. a perfectly
    flat histogram correlates at exactly `0.0` with all 24) resolve to
    whichever candidate is examined first (`tonic` ascending from C, major
    before minor) — an arbitrary but deterministic tie-break, which is all
    a `0.0`-confidence tie deserves.
    """
    best_corr = float("-inf")
    best_name = ""
    for tonic in range(12):
        for mode_name, profile in (("major", _MAJOR_PROFILE), ("minor", _MINOR_PROFILE)):
            # profile[0] is the tonic's own weight; rotate so pitch class
            # `tonic` receives it — the weight this profile assigns to
            # pitch class p under this tonic is profile[(p - tonic) % 12].
            rotated = tuple(profile[(p - tonic) % 12] for p in range(12))
            corr = _pearson_correlation(histogram, rotated)
            if corr > best_corr:
                best_corr = corr
                best_name = f"{_NOTE_NAMES[tonic]} {mode_name}"
    return best_name, best_corr


class _NoteEvent(NamedTuple):
    pitch: int
    start: float  # seconds from the file's start
    end: float


class _ParsedMidi(NamedTuple):
    notes: list[_NoteEvent]
    tempo_usec_per_beat: int | None  # first `set_tempo` meta seen, or None
    duration_seconds: float  # elapsed time across the whole merged event stream


def _mido_attr(name: str) -> Any:
    """`mido` ships no type stubs (no `py.typed`), so a *direct*
    `mido.<attr>` access infers as "Unknown" under pyright strict — and,
    per `app/storage.py`'s identical boto3 boundary (this function's
    structural precedent), that taint survives even an explicit `: Any` on
    the assignment target, resurfacing at every later use of the value.
    Going through `getattr` with a plain `str`-typed name (this function's
    own `name: str` parameter, not a literal at the call site) resolves
    through typeshed's own `getattr(o: object, name: str) -> Any` overload
    instead of mido's inferred one, so what comes back is a clean `Any`
    with nothing left to leak. This is the one boundary in this module
    where mido's untyped-ness is absorbed — `_parse` below is fully typed
    against the clean `Any` values it gets from here.
    """
    return getattr(mido, name)


def _parse(data: bytes) -> _ParsedMidi:
    """Walk every track in playback order — `mido.merge_tracks` interleaves
    them into one time-ordered stream, converting each message's tick delta
    to seconds via the tempo in effect at that point — pairing each
    `note_on`/`note_off` into a `_NoteEvent`.

    A `note_on` that never gets a matching `note_off` before the stream
    ends (malformed or truncated MIDI) is closed off at the file's last
    event time rather than dropped, so one bad file can't silently erase a
    note from `note_count` or the pitch histogram. A `note_on` for a
    `(channel, note)` pair that's already sounding (a retrigger with no
    intervening `note_off` — legal SMF, rare in a single-voice capture)
    simply replaces the pending start time: this extractor doesn't attempt
    to invent a synthetic `note_off` for it, a known simplification for
    what PV3 actually needs to handle.
    """
    midi_file_cls: Any = _mido_attr("MidiFile")
    mid_file: Any = midi_file_cls(file=io.BytesIO(data))
    ticks_per_beat: int = mid_file.ticks_per_beat
    tracks: Any = mid_file.tracks

    merge_tracks: Any = _mido_attr("merge_tracks")
    tick2second: Any = _mido_attr("tick2second")

    tempo = _DEFAULT_TEMPO_USEC_PER_BEAT
    first_tempo: int | None = None
    clock = 0.0
    active: dict[tuple[int, int], float] = {}
    notes: list[_NoteEvent] = []

    for msg in merge_tracks(tracks):
        msg_time: int = msg.time
        elapsed: float = tick2second(msg_time, ticks_per_beat, tempo)
        clock += elapsed
        msg_type: str = msg.type
        if msg_type == "set_tempo":
            msg_tempo: int = msg.tempo
            if first_tempo is None:
                first_tempo = msg_tempo
            tempo = msg_tempo
        elif msg_type == "note_on" and msg.velocity > 0:
            channel: int = msg.channel
            note: int = msg.note
            active[(channel, note)] = clock
        elif msg_type == "note_off" or (msg_type == "note_on" and msg.velocity == 0):
            channel = msg.channel
            note = msg.note
            key = (channel, note)
            start = active.pop(key, None)
            if start is not None:
                notes.append(_NoteEvent(pitch=note, start=start, end=clock))

    # Anything still "on" when the stream ends — close it at the last event
    # time instead of losing it.
    for (_, pitch), start in active.items():
        notes.append(_NoteEvent(pitch=pitch, start=start, end=clock))

    return _ParsedMidi(notes=notes, tempo_usec_per_beat=first_tempo, duration_seconds=clock)


def _mean_polyphony(notes: list[_NoteEvent]) -> float:
    """Time-weighted average number of simultaneously sounding notes,
    averaged over the span from the first note's onset to the last note's
    release — deliberately *not* the whole file's `duration_ms` (which can
    include leading/trailing silence a capture tool padded in, understating
    polyphony for no musically meaningful reason).
    """
    if not notes:
        return 0.0
    boundaries = sorted([(n.start, 1) for n in notes] + [(n.end, -1) for n in notes])
    span_start, span_end = boundaries[0][0], boundaries[-1][0]
    if span_end <= span_start:
        return 1.0  # one or more zero-duration notes at a single instant
    concurrent = 0
    weighted = 0.0
    prev_time = span_start
    for time, delta in boundaries:
        weighted += concurrent * (time - prev_time)
        concurrent += delta
        prev_time = time
    return weighted / (span_end - span_start)


def _pitch_class_histogram(notes: list[_NoteEvent]) -> tuple[float, ...] | None:
    """Duration-weighted pitch-class distribution, normalised to sum to 1:
    a held note should carry more weight toward the key guess than a
    passing grace note, which a plain note-*count* histogram can't express.

    Returns `None` for an empty note list — there is nothing to
    distribute — which is what tells `run()` to skip both
    `pitch_class_histogram` and `key_guess` for a silent/note-less file
    (see `run()`'s comment on that). Falls back to equal per-note weight
    only in the degenerate case where every note has zero measured
    duration (e.g. malformed coincident `note_on`/`note_off` pairs) —
    duration-weighting a zero-duration file is undefined, not "zero
    signal", and a histogram is still knowable from note count alone.
    """
    if not notes:
        return None
    total_duration = sum(n.end - n.start for n in notes)
    weights = [0.0] * 12
    if total_duration > 0.0:
        for n in notes:
            weights[n.pitch % 12] += n.end - n.start
        return tuple(w / total_duration for w in weights)
    for n in notes:
        weights[n.pitch % 12] += 1.0
    return tuple(w / len(notes) for w in weights)


class MidiFeatures:
    """`midi-features@1.0.0` — see module docstring."""

    name = "midi-features"
    version = "1.0.0"

    def run(self, ctx: ExtractorContext) -> list[PropertyOut | AssetOut]:
        if not ctx.run.input_sha256s:
            raise ValueError(
                "midi-features requires at least one input (the .mid asset's sha256)"
            )
        # The upload path (`app/routers/idea_assets.py`) always enqueues
        # exactly this one input — the asset's own sha256 — so `[0]` is
        # unambiguous; a run posted with more than one input would be a
        # caller bug, not something this extractor guesses a merge
        # strategy for.
        data = ctx.read_input(ctx.run.input_sha256s[0])
        parsed = _parse(data)

        bpm = (
            round(60_000_000 / parsed.tempo_usec_per_beat)
            if parsed.tempo_usec_per_beat
            else DEFAULT_TEMPO_BPM
        )
        lowest = min((n.pitch for n in parsed.notes), default=None)
        highest = max((n.pitch for n in parsed.notes), default=None)

        properties: list[PropertyOut | AssetOut] = [
            PropertyOut(kind="note_count", payload={"count": len(parsed.notes)}),
            PropertyOut(kind="tempo", payload={"bpm": bpm}),
            PropertyOut(
                kind="duration_ms",
                payload={"durationMs": round(parsed.duration_seconds * 1000)},
            ),
            PropertyOut(
                kind="piano_roll_summary",
                payload={
                    "lowestPitch": lowest,
                    "highestPitch": highest,
                    "meanPolyphony": _mean_polyphony(parsed.notes),
                },
            ),
        ]

        # Judgment call (PV3's design notes): an empty or note-less MIDI
        # file — silence, or a metadata-only file — has no pitch content to
        # summarise. Duration-weighting an empty set divides by zero, and
        # correlating an all-zero vector against every K-S profile rotation
        # is undefined (zero variance on both sides — see
        # `_pearson_correlation`). Rather than fabricate a flat histogram or
        # a coin-flip key with fake confidence, this extractor reports no
        # `pitch_class_histogram`/`key_guess` property for that run at all.
        # A caller still sees every other fact (`note_count: 0`, `tempo`,
        # `duration_ms`, a `piano_roll_summary` with null pitches) — just
        # not a fabricated key.
        histogram = _pitch_class_histogram(parsed.notes)
        if histogram is not None:
            properties.append(
                PropertyOut(kind="pitch_class_histogram", payload={"histogram": list(histogram)})
            )
            key_name, confidence = _guess_key(histogram)
            properties.append(
                PropertyOut(kind="key_guess", payload={"key": key_name}, confidence=confidence)
            )

        return properties


register(MidiFeatures())
