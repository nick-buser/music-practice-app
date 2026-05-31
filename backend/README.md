# Soundings backend

Thin CRUD/sync API for the practice app — built to grow into music computation
(Verovio/music21) later without a rewrite.

**Stack:** uv · FastAPI · Pydantic v2 · SQLAlchemy 2.0 (typed, sync/psycopg 3) ·
Alembic · Ruff · Pyright · pytest · OpenTelemetry → SigNoz · structlog.

## Layout

```
app/
  config.py          typed settings (pydantic-settings)
  db.py              engine + session dependency (sync)
  deps.py            get_current_user (the auth seam) + pagination
  errors.py          RFC 9457 problem+json handlers
  models/            SQLAlchemy 2.0 models (+ UUID/timestamp/soft-delete/owned mixins)
  schemas/           Pydantic DTOs incl. the canonical ChordIdentity
  repositories/      owner-scoped, soft-delete-aware data access
  routers/           health (root) + /v1 resources
  main.py            app factory: lifespan, CORS, request-id, OTel
migrations/          Alembic (initial schema + seeded default user)
tests/               SQLite by default; -m integration (Postgres) / -m contract
scripts/export_openapi.py   → openapi.json (frontend client is generated from this)
```

## Design decisions worth knowing

- **Single-tenant now, multi-tenant-ready.** One seeded default user; every owned
  row carries `user_id`. `app/deps.py::get_current_user` is the only thing to
  change to turn on real auth — no schema migration.
- **Offline-ready data.** Client-mintable UUID PKs, `updated_at`, soft deletes —
  the columns a sync engine (PowerSync/Electric) would need, in from the start.
- **`ChordIdentity` is server-owned.** It mirrors the TS type; the frontend type
  should be generated from `openapi.json`, not hand-kept in parallel. The server
  validates the shape and stores it as a JSON document — it does *not* re-derive
  engravings (that stays single-source in TS until there's a reason to render
  server-side, at which point Verovio-in-Python renders the ABC the client emits).
- **Heavy/music work goes behind a job boundary later.** Verovio/music21 are
  CPU-bound; the API is shaped so they become enqueue→poll, never inline.

## Develop

```sh
uv sync                      # create the venv from the lockfile
cp .env.example .env         # point DATABASE_URL at homelab Postgres (or leave unset → SQLite)
uv run uvicorn app.main:app --reload
uv run pytest                # fast SQLite suite
uv run pytest -m integration # real Postgres (needs Docker)
uv run pytest -m contract    # schemathesis OpenAPI fuzz
uv run ruff check . && uv run ruff format --check . && uv run pyright
uv run python scripts/export_openapi.py
```

## Run (homelab)

```sh
docker compose up --build    # Postgres + API; entrypoint runs `alembic upgrade head`
```

## Contract sharing

`scripts/export_openapi.py` writes `openapi.json`. Generate the SPA client from
it (`openapi-typescript` + `openapi-fetch`) and fail CI on drift, so the API and
the frontend types can't diverge.
