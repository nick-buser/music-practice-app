"""ideas_search: SB5's Postgres-only generated `search_tsv` tsvector column
plus its GIN index (docs/sketchbook.md's "Search" seed).

Guarded by `dialect.name != "postgresql"` in both directions, mirroring the
SQLite/Postgres fork everywhere else this app touches JSON
(`app/models/idea.py`'s `IdeaJSON`): SQLite has no `tsvector`/`to_tsvector`
at all, so this migration is a no-op there and the local round trip
(`alembic upgrade head` / `downgrade base` against the SQLite dev DB) stays
green with no `search_tsv` column ever appearing.

`search_tsv` is *generated*, not trigger-maintained, because Postgres can
keep a `STORED` generated column in sync on every insert/update for free —
no separate write path to forget, no risk of the index drifting from
`title`/`body`/`tags`. That requires the generation expression to be
IMMUTABLE: the two-arg `to_tsvector(regconfig, text)` is (the one-arg form
that reads `default_text_search_config` is only STABLE and Postgres rejects
it here), and `tags::text` on a jsonb column is IMMUTABLE too — the
one-arg `to_tsvector(text)` and any datestyle-dependent cast would not be.

`app/models/idea.py::IDEA_SEARCH_TSV` is the unmapped SQLAlchemy expression
the Postgres branch of `app/repositories/ideas.py::list_ideas` queries
against — see that module for why it isn't a `mapped_column`.

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-03
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(
        sa.text(
            """
            ALTER TABLE ideas ADD COLUMN search_tsv tsvector
              GENERATED ALWAYS AS (
                to_tsvector('english',
                  coalesce(title, '') || ' ' || coalesce(body, '') || ' '
                  || coalesce(tags::text, ''))
              ) STORED
            """
        )
    )
    op.create_index("ix_ideas_search_tsv", "ideas", ["search_tsv"], postgresql_using="gin")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.drop_index("ix_ideas_search_tsv", table_name="ideas")
    op.drop_column("ideas", "search_tsv")
