# CI (Woodpecker)

Two workflows run in parallel, each path-filtered to its package:

- **frontend.yml** — `npm ci` → `typecheck` → `gen:api:check` (contract drift) → `vitest` → `build`
- **backend.yml** — `uv sync` → `ruff` (+ format check) → `pyright` → `pytest` (incl. the openapi-drift guard)

Together they make every guardrail in the repo *bite* on push/PR: types, lint,
the backend↔openapi↔frontend contract chain, tests, and a clean build.

## Assumptions (written from general Woodpecker knowledge)

These were authored without the server config, so check them against your setup:

- **Schema:** Woodpecker **≥ 1.0** (`steps:` + `when:` map). Older 0.15.x used
  `pipeline:` / `branches:`.
- **Backend:** Docker, with network egress to pull images, the npm registry, and
  PyPI (plus the Node that the `pyright` pip package fetches on first run).
- **Multi-workflow:** the `.woodpecker/` *directory* form. If your server is
  pinned to a single `.woodpecker.yml`, merge these two into one file.
- **Shared workspace:** later steps reuse `app/node_modules` and `backend/.venv`
  from the setup steps (standard Woodpecker behaviour). If your agent isolates
  steps, collapse each workflow into a single step.

## One manual step

Enable the repo in the Woodpecker UI (it can't be done from code). No secrets are
required for these validation workflows.

## Extending

**Real-Postgres backend tests** — add a service and point the suite at it (the
test harness uses `DATABASE_URL` if already set, else SQLite):

```yaml
  - name: test-postgres
    image: ghcr.io/astral-sh/uv:python3.12-bookworm-slim
    environment:
      DATABASE_URL: postgresql+psycopg://postgres:postgres@postgres:5432/postgres
    commands:
      - cd backend
      - uv run pytest
services:
  - name: postgres
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
```

**Deploy the public frontend to Cloudflare Pages** — a separate workflow gated on
the default branch, using Woodpecker secrets `cloudflare_api_token` /
`cloudflare_account_id` (set them in the repo UI):

```yaml
when:
  event: push
  branch: main
  path: { include: ['app/**'] }
steps:
  - name: deploy
    image: node:22
    environment:
      CLOUDFLARE_API_TOKEN: { from_secret: cloudflare_api_token }
      CLOUDFLARE_ACCOUNT_ID: { from_secret: cloudflare_account_id }
    commands:
      - cd app
      - npm ci && npm run build
      - npx wrangler pages deploy   # uses app/wrangler.jsonc (no backend env → public build)
```
