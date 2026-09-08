"""Tests for the snippet importer (`scripts/import_snippets.py`).

The importer is an operator tool that talks to a deployed slot over HTTP, so
its network path is not exercised here — what *is* exercised is everything
that decides what gets sent: the filename conventions it reads, the roles it
assigns, and the identity rule the whole idempotency story rests on.
"""

from __future__ import annotations

import datetime as dt
import os
import uuid
from pathlib import Path

import pytest

from scripts.import_snippets import (
    Snippet,
    build_multipart,
    captured_at_for,
    collect,
    mime_for,
    parse_key,
    role_for,
    title_for,
)


class TestParseKey:
    """`parse_key` reads a key the filename *states* — it never guesses one."""

    @pytest.mark.parametrize(
        ("stem", "expected"),
        [
            # The three real captures this importer was written for. These
            # went through a version whose `\b` boundaries matched nowhere in
            # an underscore-separated name (`_` is a word character), so every
            # one of them silently parsed as `None`.
            ("2026-09-06_a_minor_melody1", "A minor"),
            ("2026-09-06_d_minor_melody_1", "D minor"),
            ("2026-09-07_a_minor_somber", "A minor"),
            # Accidentals, in each spelling the convention allows.
            ("2026-01-02_bb_major_waltz", "B♭ major"),
            ("2026-01-02_f_sharp_minor_etude", "F♯ minor"),
            ("2026-01-02_c#_minor_prelude", "C♯ minor"),
            ("2026-01-02_e_flat_major_song", "E♭ major"),
            # Already space-separated (what `title_for` re-matches against).
            ("a minor melody", "A minor"),
        ],
    )
    def test_reads_a_stated_key(self, stem: str, expected: str) -> None:
        assert parse_key(stem) == expected

    @pytest.mark.parametrize(
        "stem",
        [
            "untitled_doodle",
            "2026-01-02_something_quiet",
            # `d` here is the tail of a word, not a tonic — the lookbehind is
            # what keeps this from parsing as "D major".
            "2026-01-02_grand_major_thing",
        ],
    )
    def test_no_key_rather_than_a_guess(self, stem: str) -> None:
        assert parse_key(stem) is None


class TestTitleFor:
    @pytest.mark.parametrize(
        ("stem", "expected"),
        [
            ("2026-09-06_a_minor_melody1", "A minor melody 1"),
            ("2026-09-06_d_minor_melody_1", "D minor melody 1"),
            ("2026-09-07_a_minor_somber", "A minor somber"),
            # The key is rewritten in ♯/♭ form in place.
            ("2026-01-02_bb_major_waltz", "B♭ major waltz"),
            ("2026-01-02_f_sharp_minor_etude", "F♯ minor etude"),
            # No date prefix, no key: still humanised.
            ("untitled_doodle", "Untitled doodle"),
        ],
    )
    def test_humanises_the_stem(self, stem: str, expected: str) -> None:
        assert title_for(stem) == expected


class TestRolesAndMimes:
    @pytest.mark.parametrize(
        ("filename", "role"),
        [
            # "raw is immortal": the played-in MIDI is the idea itself.
            ("take.mid", "melody"),
            ("take.midi", "melody"),
            # "derived is recomputable": the bounce is a render.
            ("take.wav", "render"),
            ("take.mp3", "render"),
            ("take.flac", "render"),
            # A Spectrasonics patch is none of the musical roles.
            ("take.keyscape", "other"),
            ("take.rpp", "rpp"),
            ("scan.pdf", "score"),
            ("photo.jpg", "image"),
            ("notes.txt", "other"),
        ],
    )
    def test_role_follows_the_sketchbook_doc(self, filename: str, role: str) -> None:
        assert role_for(Path(filename)) == role

    def test_role_is_case_insensitive(self) -> None:
        assert role_for(Path("TAKE.WAV")) == "render"

    def test_midi_mime_is_the_one_that_enqueues_extraction(self) -> None:
        # `app/routers/idea_assets.py::_MIDI_MIME_TYPES` only auto-enqueues a
        # `midi-features` run for `audio/midi` / `audio/x-midi`. `mimetypes`
        # does not reliably produce either, so the importer must pin it —
        # otherwise every imported `.mid` silently skips extraction.
        assert mime_for(Path("take.mid")) == "audio/midi"
        assert mime_for(Path("take.midi")) == "audio/midi"

    def test_unknown_suffix_falls_back_to_octet_stream(self) -> None:
        assert mime_for(Path("take.keyscape")) == "application/octet-stream"
        assert mime_for(Path("take.wat")) == "application/octet-stream"


class TestIdeaIdentity:
    """The idempotency contract: same stem ⇒ same idea id, forever."""

    @pytest.mark.parametrize(
        ("stem", "expected"),
        [
            ("2026-09-06_a_minor_melody1", "a311555e-35d7-5f66-b403-79e122a58da6"),
            ("2026-09-06_d_minor_melody_1", "9e2ca069-c3a6-54c0-bc18-5d6c39ee3818"),
            ("2026-09-07_a_minor_somber", "9694c4fc-5db7-5839-b21f-785e254b1a15"),
        ],
    )
    def test_ids_are_pinned(self, stem: str, expected: str) -> None:
        # These three are the ids of ideas that already exist on the prod
        # slot. If this test fails, the namespace or the derivation changed
        # and a re-run would import duplicates instead of recognising them.
        assert Snippet(stem=stem, files=()).idea_id == uuid.UUID(expected)

    def test_different_stems_get_different_ids(self) -> None:
        assert Snippet("a", ()).idea_id != Snippet("b", ()).idea_id


class TestCollect:
    def test_groups_files_by_stem(self, tmp_path: Path) -> None:
        for name in ("take.mid", "take.wav", "take.keyscape", "other.mid"):
            (tmp_path / name).write_bytes(b"x")

        snippets = collect(tmp_path)

        assert [s.stem for s in snippets] == ["other", "take"]
        assert [p.name for p in snippets[1].files] == [
            "take.keyscape",
            "take.mid",
            "take.wav",
        ]

    def test_recurses_and_skips_dotfiles(self, tmp_path: Path) -> None:
        (tmp_path / "melodies").mkdir()
        (tmp_path / "melodies" / "take.mid").write_bytes(b"x")
        (tmp_path / ".DS_Store").write_bytes(b"x")

        snippets = collect(tmp_path)

        assert [s.stem for s in snippets] == ["take"]

    def test_empty_directory(self, tmp_path: Path) -> None:
        assert collect(tmp_path) == []


class TestCapturedAt:
    def test_uses_the_mtime_when_it_agrees_with_the_filename_date(self, tmp_path: Path) -> None:
        path = tmp_path / "2026-09-06_take.mid"
        path.write_bytes(b"x")
        when = dt.datetime(2026, 9, 6, 3, 41, 0, tzinfo=dt.UTC)
        os.utime(path, (when.timestamp(), when.timestamp()))

        assert captured_at_for("2026-09-06_take", [path]) == "2026-09-06T03:41:00Z"

    def test_falls_back_to_midnight_when_the_mtime_disagrees(self, tmp_path: Path) -> None:
        # A file copied or re-bounced later carries an mtime that says nothing
        # about when the idea was played — the stated date is the honest answer.
        path = tmp_path / "2026-09-06_take.mid"
        path.write_bytes(b"x")
        later = dt.datetime(2026, 9, 30, 12, 0, 0, tzinfo=dt.UTC)
        os.utime(path, (later.timestamp(), later.timestamp()))

        assert captured_at_for("2026-09-06_take", [path]) == "2026-09-06T00:00:00Z"

    def test_no_date_in_the_name_defers_to_the_server(self, tmp_path: Path) -> None:
        path = tmp_path / "take.mid"
        path.write_bytes(b"x")

        assert captured_at_for("take", [path]) is None


class TestMultipart:
    def test_carries_the_file_role_and_bytes(self, tmp_path: Path) -> None:
        path = tmp_path / "take.mid"
        path.write_bytes(b"MThd\x00binary\xff")

        body, content_type = build_multipart(path, "melody")

        assert content_type.startswith("multipart/form-data; boundary=")
        boundary = content_type.split("boundary=")[1]
        assert body.startswith(f"--{boundary}\r\n".encode())
        assert body.endswith(f"\r\n--{boundary}--\r\n".encode())
        assert b'name="role"\r\n\r\nmelody' in body
        assert b'name="file"; filename="take.mid"' in body
        assert b"Content-Type: audio/midi" in body
        # The raw bytes survive intact — no encoding step in the middle.
        assert b"MThd\x00binary\xff" in body
