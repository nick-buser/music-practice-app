"""Recordings and their tracks — the tables the capture UI, the extractors,
and tempo-vs-target all hang on (docs/recordings-provenance.md).

`Recording` is one practice event ("tracks, not files" — the doc's design
decision list). `RecordingTrack` is one captured stream of it: audio, MIDI,
or both. A recording may be **MIDI-only** (a sight-reading attempt is one),
so no track row is required at creation — tracks are attached afterward via
`POST /v1/recordings/{id}/tracks`, exactly as `IdeaAsset` rows are attached
to an already-persisted `Idea`.

`kind` is a plain `String` column with a `CheckConstraint`, not a
SQLAlchemy `Enum`, mirroring `app/models/provenance.py`'s docstring and
`app/models/idea.py`'s: nothing else in `app/models/` uses `Enum`, and a
native Postgres enum would need a `DROP TYPE` in this migration's
`downgrade()` that a CHECK constraint doesn't.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, OwnedMixin, PKMixin, SoftDeleteMixin, TimestampMixin
from app.recordings import RecordingTrackKind


class Recording(PKMixin, OwnedMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "recordings"
    __table_args__ = (
        # `subject_kind`/`subject_id` move together: both NULL (free
        # practice, a sketchbook voice capture) or both set. Enforced here
        # rather than left to application code, matching this codebase's
        # habit of encoding invariants as CHECK constraints rather than
        # trusting every future write path to remember them.
        CheckConstraint(
            "(subject_kind IS NULL) = (subject_id IS NULL)",
            name="ck_recordings_subject_pair",
        ),
    )

    # Both NULL for free practice and sketchbook voice captures (an inbox
    # item with no subject yet); otherwise the same string-composition rule
    # as `practice_sessions.subject_id` and PV1's `ExtractionRun` — see
    # `app.provenance.compose_subject`, which already reserves `"recording"`
    # in `_UUID_BACKED_SUBJECT_KINDS` for this table's own future use as an
    # extraction subject. Unlike `ExtractionRun.subject_kind`, this is not
    # itself that composed form — it names what the recording is *of*
    # (a piece, a generated exercise, an idea, ...), not the recording
    # itself. No `CheckConstraint` vocabulary on `subject_kind`'s values,
    # mirroring `ExtractionRun.subject_kind` (also unconstrained): the set
    # of subject kinds is open-ended and owned by `app/src/data/subject.ts`,
    # not this table.
    subject_kind: Mapped[str | None] = mapped_column(String, index=True, default=None)
    subject_id: Mapped[str | None] = mapped_column(String, index=True, default=None)
    # Optional context: the practice session this recording was captured
    # within. `SET NULL` (not `CASCADE`) — a recording's bytes and the
    # provenance built on them outlive the session that happened to be
    # running when it was captured; losing that context is not a reason to
    # lose the recording (practice sessions are soft-deleted in practice
    # anyway, via `soft_delete_session`, so this FK's ON DELETE behavior is
    # defensive schema hygiene rather than something a normal request path
    # ever triggers).
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("practice_sessions.id", ondelete="SET NULL"), index=True, default=None
    )
    # t = 0 on "the recording clock" (docs/recordings-provenance.md) that
    # every track's `offset_ms` and every extracted property's `time_range`
    # are anchored against.
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer, default=None)
    notes: Mapped[str | None] = mapped_column(String, default=None)


class RecordingTrack(PKMixin, TimestampMixin, SoftDeleteMixin, Base):
    """One captured stream of a recording — mirrors `IdeaAsset`
    (`app/models/idea.py`) closely: no `OwnedMixin`, because ownership lives
    on `recording_id`'s `Recording` (every route reaches a track only after
    first loading its owner-scoped recording, exactly as idea assets reach
    theirs through `Idea`), and it carries `SoftDeleteMixin` because raw
    bytes are immortal — a delete retires this row, never the object at
    `storage_key` (`app.storage`).
    """

    __tablename__ = "recording_tracks"
    __table_args__ = (CheckConstraint("kind IN ('audio','midi')", name="ck_recording_tracks_kind"),)

    recording_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recordings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[RecordingTrackKind] = mapped_column(String, index=True)
    # Content-addressed — `app.storage.content_key(sha256)` — so identical
    # bytes reused across tracks (even across recordings) share one object.
    storage_key: Mapped[str] = mapped_column(String, index=True)
    mime: Mapped[str] = mapped_column(String)
    bytes: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String, index=True)
    # Track start minus `recording.captured_at` — the recording clock (F1
    # amendment 2026-09-02, docs/recordings-provenance.md): audio = when
    # `MediaRecorder` actually started; MIDI = the first count-in click or
    # first captured event. Signed and deliberately unconstrained (no
    # non-negative CHECK): a track can legitimately start *before* the
    # recording clock's zero — e.g. a MIDI count-in armed slightly ahead of
    # the audio stream — so rejecting a negative value would reject a real
    # take, not just bad data.
    offset_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
