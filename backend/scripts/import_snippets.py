#!/usr/bin/env python3
"""Import a directory of captured snippets into a Soundings sketchbook.

The capture path this exists for: you noodle in Keyscape (or any DAW), bounce
the take, and end up with a folder of files that share a stem —
`2026-09-06_a_minor_melody1.{mid,wav,keyscape}`. Each stem is one musical
idea recorded in three formats, and this turns each stem into one
`Idea` with its files attached in the roles `docs/sketchbook.md` defines.

Run it against the deployed API over HTTP rather than the database, so it
goes through the same upload path (`POST /v1/ideas/{id}/assets`) the UI and
the REAPER sidecar use — content-addressed storage, sha256, the MIDI
auto-enqueue — with no special-cased import route to keep in sync.

**Idempotent by construction.** An idea's id is `uuid5(_NAMESPACE, stem)`, so
re-running names the same rows rather than minting duplicates: an existing
idea is left alone, and an asset whose sha256 the idea already carries is
skipped. That makes the safe operator move "just run it again" — after a
partial upload, after adding a `.wav` to a stem imported as `.mid` only, or
to check a directory is fully imported.

What it does NOT do is guess at music. Key and capture date come from the
filename convention (`YYYY-MM-DD_<key>_<name>`) because those are things the
capture already knows; tempo, note count, duration and a key *guess* are the
`midi-features` extractor's job (`app/jobs/extractors/midi_features.py`),
which the `.mid` upload enqueues on its own.

Usage:

    uv run python scripts/import_snippets.py ~/Documents/piano_snippets --dry-run
    uv run python scripts/import_snippets.py ~/Documents/piano_snippets \
        --base-url https://soundings.k8s.bittern-chameleon.dev/api
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import mimetypes
import re
import sys
import urllib.error
import urllib.request
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

# Fixed once and never regenerated: it is half the identity of every idea this
# script has ever created. Changing it re-imports everything as duplicates.
_NAMESPACE = uuid.UUID("6f1d5b6a-1f3a-5c9e-9b7a-2f0c4d8e13a7")

_DEFAULT_BASE_URL = "https://soundings.k8s.bittern-chameleon.dev/api"

# `docs/sketchbook.md`'s "raw is immortal, derived is recomputable" split, as
# roles: the `.mid` you played in is the idea itself (`melody`), the bounce is
# a `render` — reproducible from the MIDI plus the patch, and cheap to lose.
# The patch is none of the musical roles, so it is honestly `other` rather
# than squeezed into `rpp` (which the enum names for REAPER projects).
_ROLE_BY_SUFFIX: dict[str, str] = {
    ".mid": "melody",
    ".midi": "melody",
    ".wav": "render",
    ".mp3": "render",
    ".flac": "render",
    ".aif": "render",
    ".aiff": "render",
    ".m4a": "render",
    ".ogg": "render",
    ".opus": "render",
    ".keyscape": "other",
    ".rpp": "rpp",
    ".pdf": "score",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
}

# `mimetypes` has no entry for either, and both matter: the MIDI type is what
# makes the upload route enqueue a `midi-features` run, and a Spectrasonics
# patch is a proprietary container with no registered type.
_MIME_BY_SUFFIX: dict[str, str] = {
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".keyscape": "application/octet-stream",
    ".rpp": "text/plain",
}

# `2026-09-06_a_minor_melody1` → the date, and the rest as the title source.
_DATED_STEM_RE = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})[_-](?P<rest>.+)$")

# `a_minor`, `bb_major`, `f_sharp_minor`, `c#_minor` — the key, if the
# filename states one. Anything else just yields no key, never a guess.
# Spaces count as separators too, so `title_for` can re-match its own
# space-separated words to rewrite the key in ♯/♭ form.
#
# The boundaries are `(?<![a-z])`/`(?![a-z])` rather than `\b`, because every
# real filename here separates words with `_` — and `_` is a word character,
# so `\b` matches *nowhere* in `2026-09-06_a_minor_melody1`. With `\b` this
# silently returned `None` for every snippet it was written for.
_KEY_RE = re.compile(
    r"(?<![a-z])(?P<tonic>[a-g])[\s_-]?(?P<accidental>sharp|flat|#|b)?"
    r"[\s_-](?P<mode>minor|major)(?![a-z])",
    re.IGNORECASE,
)

_ACCIDENTALS = {"sharp": "♯", "#": "♯", "flat": "♭", "b": "♭"}

# Trailing digits glued to a word (`melody1`) read as a numbered take.
_TRAILING_DIGITS_RE = re.compile(r"([a-z])(\d+)$", re.IGNORECASE)


@dataclass(frozen=True)
class Snippet:
    """One musical idea: every file sharing a filename stem."""

    stem: str
    files: tuple[Path, ...]

    @property
    def idea_id(self) -> uuid.UUID:
        return uuid.uuid5(_NAMESPACE, self.stem)


@dataclass
class Report:
    """What actually happened, so the summary is counted rather than claimed."""

    ideas_created: list[str] = field(default_factory=list[str])
    ideas_existing: list[str] = field(default_factory=list[str])
    assets_uploaded: list[str] = field(default_factory=list[str])
    assets_skipped: list[str] = field(default_factory=list[str])
    failures: list[str] = field(default_factory=list[str])


def role_for(path: Path) -> str:
    return _ROLE_BY_SUFFIX.get(path.suffix.lower(), "other")


def mime_for(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in _MIME_BY_SUFFIX:
        return _MIME_BY_SUFFIX[suffix]
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"


def parse_key(text: str) -> str | None:
    """The key the filename states, normalised — or `None`.

    Never infers a key from anything but the name: a guess from the notes is
    `midi-features`' `key_guess` property, which carries a confidence this
    function has no way to produce.
    """
    match = _KEY_RE.search(text)
    if match is None:
        return None
    tonic = match.group("tonic").upper()
    accidental = match.group("accidental")
    symbol = _ACCIDENTALS.get(accidental.lower(), "") if accidental else ""
    return f"{tonic}{symbol} {match.group('mode').lower()}"


def title_for(stem: str) -> str:
    """A human title from the stem: drop the date, unglue numbered takes, and
    capitalise a stated key so `a_minor_melody1` reads `A minor melody 1`.
    """
    match = _DATED_STEM_RE.match(stem)
    rest = match.group("rest") if match else stem
    words = _TRAILING_DIGITS_RE.sub(r"\1 \2", rest.replace("_", " ").replace("-", " "))
    words = " ".join(words.split())
    key = parse_key(rest)
    if key is not None:
        # Rewrite the key words in place so the title carries the ♯/♭ form.
        words = _KEY_RE.sub(key, words, count=1)
    return words[:1].upper() + words[1:] if words else stem


def captured_at_for(stem: str, files: Sequence[Path]) -> str | None:
    """The capture time, ISO-8601, or `None` to let the server default to now.

    The filename carries the date; the earliest file mtime carries the time of
    day. They are used together only when they agree on the date — a file
    copied or re-bounced later has an mtime that says nothing about when the
    idea was played, and in that case the date alone (at midnight UTC) is the
    honest answer.
    """
    match = _DATED_STEM_RE.match(stem)
    if match is None:
        return None
    date = match.group("date")
    try:
        parsed_date = dt.date.fromisoformat(date)
    except ValueError:
        return None
    mtimes = [f.stat().st_mtime for f in files]
    if mtimes:
        earliest = dt.datetime.fromtimestamp(min(mtimes), tz=dt.UTC)
        if earliest.date() == parsed_date:
            return earliest.isoformat().replace("+00:00", "Z")
    return f"{date}T00:00:00Z"


def collect(directory: Path) -> list[Snippet]:
    """Every stem under `directory`, recursively, with its files.

    Subdirectories are traversed but do not group: `melodies/x.mid` and
    `chords/x.wav` would be one idea, because a shared stem means a shared
    take in the convention this reads.
    """
    by_stem: dict[str, list[Path]] = {}
    for path in sorted(directory.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        by_stem.setdefault(path.stem, []).append(path)
    return [Snippet(stem=stem, files=tuple(files)) for stem, files in sorted(by_stem.items())]


class ApiError(RuntimeError):
    def __init__(self, status: int, body: str) -> None:
        super().__init__(f"HTTP {status}: {body[:400]}")
        self.status = status


class Client:
    """The smallest HTTP client that does the job — stdlib only.

    Deliberately not `httpx`/`requests`: this runs as an operator tool on a
    laptop, and a snippet import should never be the reason a dependency has
    to be installed somewhere.
    """

    def __init__(self, base_url: str, timeout: float = 300.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: bytes | None = None,
        content_type: str | None = None,
    ) -> tuple[int, bytes]:
        request = urllib.request.Request(f"{self.base_url}{path}", data=body, method=method)
        if content_type is not None:
            request.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return int(response.status), cast(bytes, response.read())
        except urllib.error.HTTPError as exc:
            return int(exc.code), exc.read()

    def get_json(self, path: str) -> dict[str, Any] | None:
        """Parsed JSON, or `None` for a 404 — the only status this treats as
        an answer rather than an error, since "does this idea exist yet" is
        the question every import starts with.
        """
        status, raw = self._request("GET", path)
        if status == 404:
            return None
        if status >= 400:
            raise ApiError(status, raw.decode("utf-8", "replace"))
        return cast("dict[str, Any]", json.loads(raw))

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        status, raw = self._request(
            "POST",
            path,
            body=json.dumps(payload).encode(),
            content_type="application/json",
        )
        if status >= 400:
            raise ApiError(status, raw.decode("utf-8", "replace"))
        return cast("dict[str, Any]", json.loads(raw))

    def post_file(self, path: str, file_path: Path, role: str) -> dict[str, Any]:
        body, content_type = build_multipart(file_path, role)
        status, raw = self._request("POST", path, body=body, content_type=content_type)
        if status >= 400:
            raise ApiError(status, raw.decode("utf-8", "replace"))
        return cast("dict[str, Any]", json.loads(raw))


def build_multipart(file_path: Path, role: str) -> tuple[bytes, str]:
    """A `multipart/form-data` body carrying the file and its `role` field.

    Reads the file whole: the largest thing this imports is a bounce of a few
    tens of MB, and streaming it would buy nothing but complexity here — the
    server side is where streaming actually matters, and it already does it.
    """
    boundary = f"----soundings{uuid.uuid4().hex}"
    filename = file_path.name.replace('"', "")
    parts: list[bytes] = [
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="role"\r\n\r\n',
        role.encode(),
        f"\r\n--{boundary}\r\n".encode(),
        (
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: {mime_for(file_path)}\r\n\r\n"
        ).encode(),
        file_path.read_bytes(),
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def existing_asset_hashes(client: Client, idea_id: uuid.UUID) -> set[str]:
    """Every sha256 the idea already carries, across all revisions.

    Asset listing is revision-grouped (`IdeaAssetRevisionGroup`), so this
    flattens it — an identical file already attached at revision 1 must not be
    re-uploaded just because a later revision exists.
    """
    raw = client.get_json(f"/v1/ideas/{idea_id}/assets")
    if raw is None:
        return set()
    groups = cast("list[dict[str, Any]]", raw) if isinstance(raw, list) else []
    return {
        str(asset["sha256"])
        for group in groups
        for asset in cast("list[dict[str, Any]]", group.get("assets", []))
    }


def import_snippet(
    client: Client,
    snippet: Snippet,
    *,
    tags: Sequence[str],
    kinds: Sequence[str],
    dry_run: bool,
    report: Report,
) -> None:
    idea_id = snippet.idea_id
    title = title_for(snippet.stem)
    existing = None if dry_run else client.get_json(f"/v1/ideas/{idea_id}")

    if existing is None:
        payload: dict[str, Any] = {
            "id": str(idea_id),
            "title": title,
            "body": _body_for(snippet),
            "status": "inbox",
            "kinds": list(kinds),
            "tags": list(tags),
            "key": parse_key(snippet.stem),
            "capturedAt": captured_at_for(snippet.stem, snippet.files),
        }
        print(f"  idea      {title}  [{idea_id}]")
        if not dry_run:
            created = client.post_json("/v1/ideas", payload)
            print(f"            → handle #{created['handle']}")
        report.ideas_created.append(title)
    else:
        print(f"  idea      {title}  [exists, handle #{existing['handle']}]")
        report.ideas_existing.append(title)

    known: set[str] = set() if dry_run else existing_asset_hashes(client, idea_id)
    for path in snippet.files:
        role = role_for(path)
        size_mb = path.stat().st_size / 1_048_576
        label = f"{path.name} ({role}, {size_mb:.1f} MB)"
        if not dry_run:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in known:
                print(f"    asset   {label} — already attached, skipped")
                report.assets_skipped.append(path.name)
                continue
        print(f"    asset   {label}")
        if dry_run:
            report.assets_uploaded.append(path.name)
            continue
        try:
            client.post_file(f"/v1/ideas/{idea_id}/assets", path, role)
            report.assets_uploaded.append(path.name)
        except (ApiError, OSError) as exc:
            print(f"            ! failed: {exc}", file=sys.stderr)
            report.failures.append(f"{path.name}: {exc}")


def _body_for(snippet: Snippet) -> str:
    """The idea's body: what the import knows, and nothing it doesn't.

    Names the source files so the idea stays traceable back to the folder it
    came from once the bytes live in Garage under content-addressed keys.
    """
    formats = ", ".join(sorted({p.suffix.lstrip(".").lower() for p in snippet.files}))
    return f"Imported from `{snippet.stem}` ({formats})."


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("directory", type=Path, help="directory of snippet files to import")
    parser.add_argument("--base-url", default=_DEFAULT_BASE_URL, help="API base URL")
    parser.add_argument("--tag", action="append", default=[], help="tag to set (repeatable)")
    parser.add_argument("--kind", action="append", default=[], help="kind to set (repeatable)")
    parser.add_argument("--dry-run", action="store_true", help="show what would happen")
    args = parser.parse_args(argv)

    directory = cast(Path, args.directory).expanduser()
    if not directory.is_dir():
        print(f"not a directory: {directory}", file=sys.stderr)
        return 2

    snippets = collect(directory)
    if not snippets:
        print(f"no files found under {directory}")
        return 0

    base_url = cast(str, args.base_url)
    dry_run = cast(bool, args.dry_run)
    tags = cast("list[str]", args.tag)
    kinds = cast("list[str]", args.kind)

    print(f"{len(snippets)} snippet(s) under {directory}")
    print(f"target: {base_url}{'  (dry run)' if dry_run else ''}\n")

    client = Client(base_url)
    report = Report()
    for snippet in snippets:
        import_snippet(client, snippet, tags=tags, kinds=kinds, dry_run=dry_run, report=report)
        print()

    _summarise(report, dry_run=dry_run)
    return 1 if report.failures else 0


def _summarise(report: Report, *, dry_run: bool) -> None:
    verb = "would create" if dry_run else "created"
    print(
        f"{verb} {len(report.ideas_created)} idea(s), "
        f"{len(report.ideas_existing)} already present; "
        f"{len(report.assets_uploaded)} asset(s) uploaded, "
        f"{len(report.assets_skipped)} skipped"
    )
    if report.failures:
        print(f"{len(report.failures)} failure(s):", file=sys.stderr)
        for failure in report.failures:
            print(f"  - {failure}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
