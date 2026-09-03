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

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
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


class RecordingCadence(PKMixin, OwnedMixin, TimestampMixin, Base):
    """ "Record this weekly" — one row per (user, subject) naming how often
    that subject wants a fresh take. RC3 (docs/recordings-provenance.md's
    workstream table); no scheduler and no background job reads this — a
    subject's due-ness is computed on read by pairing `interval_days` here
    with its latest `Recording.captured_at`, in `app/src/data/cadence.ts`'s
    `dueState`. That split is why this table carries no `subject`-shaped
    foreign key to `Recording` itself: it only ever needs to be joined
    against the *latest* one, which the frontend already fetches via
    `useRecordings`.

    Unlike `Recording.subject_kind`/`subject_id` (nullable — free practice
    has no subject), both are **required** here: a cadence is always about a
    specific subject, so there is no free-practice-shaped row to allow for.

    `subject_kind`/`subject_id` are a plain pair (no `CheckConstraint`
    vocabulary), mirroring `Recording`'s own reasoning: the set of subject
    kinds is open-ended and owned by `app/src/data/subject.ts`.

    "off" is `interval_days = NULL`, not `0` and not a deleted row:
      * `0` would be a second spelling of "off" alongside NULL — the
        `ck_recording_cadences_interval_positive` CHECK below rules it out
        so there is exactly one representation, which is what keeps turning
        a cadence off-and-on-again from ever being ambiguous about whether
        a stray `0` row means "off" or "not set".
      * A DELETE would work too, but this ticket exposes no DELETE route
        (only `PUT .../{subject_kind}/{subject_id}` and `GET` list) — NULL
        lets "off" go through the same upsert as every other interval
        change, so the picker's "off" option is just another `PUT` body,
        not a different HTTP verb with different error handling.
    The frontend picker, `RecordingCadenceUpdate` (`app/schemas/recording.py`),
    and this column all agree on that: NULL in, NULL out, "off" in the UI.
    """

    __tablename__ = "recording_cadences"
    __table_args__ = (
        # The upsert key `app.repositories.recording_cadences.upsert_cadence`
        # get-or-creates against — one cadence per user per subject, so a
        # second `PUT` on the same subject updates this row rather than
        # inserting a sibling (RC3 acceptance criterion 2).
        UniqueConstraint(
            "user_id", "subject_kind", "subject_id", name="uq_recording_cadences_subject"
        ),
        CheckConstraint(
            "interval_days IS NULL OR interval_days > 0",
            name="ck_recording_cadences_interval_positive",
        ),
    )

    subject_kind: Mapped[str] = mapped_column(String, index=True, nullable=False)
    subject_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    # NULL = "off" — see the class docstring for why this, not `0` or a
    # deleted row, is the one representation of "no cadence".
    interval_days: Mapped[int | None] = mapped_column(Integer, default=None)
