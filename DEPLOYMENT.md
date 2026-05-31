# Deployment

One codebase, two shapes. The frontend (`app/`) runs entirely on bundled static
data and client-side Verovio, so it deploys **with no backend**. The backend
(`backend/`) is an optional local power-up — it's never required by, or exposed
to, the public site.

| | Public (Cloudflare Pages) | Local (full) |
|---|---|---|
| Backend | none | FastAPI + Postgres |
| `VITE_API_BASE_URL` | unset | `http://localhost:8000` |
| `backendEnabled` (src/config.ts) | `false` | `true` |
| Features | drills, voicings, engraving — all client-side | + persistence, saved chords, sessions |
| Auth / tenancy | none (nothing to protect) | single default user, local only |

The split is enforced in code: backend-only features must gate on
`backendEnabled`, and `src/config.test.ts` fails if the default build ever
starts assuming a server. So the public deploy can't accidentally call a
backend or expose a cost centre.

## Public — Cloudflare Pages (static, free)

The build is a static SPA in `app/dist` with a `_redirects` SPA fallback.

**Via the dashboard (Git integration):**
- Root directory: `app`
- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Environment variables: none (leave `VITE_API_BASE_URL` unset)

**Via Wrangler:**
```sh
cd app
npm ci && npm run build
npx wrangler pages deploy        # uses wrangler.jsonc (pages_build_output_dir: dist)
```

## Local — full app with backend

```sh
# 1. Backend (Postgres + API) — see backend/README.md
cd backend && docker compose up --build      # API on :8000

# 2. Frontend, pointed at it
cd app
cp .env.example .env                          # uncomment VITE_API_BASE_URL=http://localhost:8000
npm install && npm run dev                    # http://localhost:5173
```

Multitenancy stays off everywhere: the backend is single-tenant and only run
locally. If it's ever exposed, flip on auth at `backend/app/deps.py::get_current_user`
first (see backend/README.md).
