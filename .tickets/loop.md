---
title: ticket-loop config
---

## Runner

in-session — `/loop /ticket-loop`; the session plays harness and dispatches
implementation to per-tier subagents. No out-of-process driver.

## Gates

Frontend (run when `app/**` or `backend/openapi.json` changed):

- cd app && npm run typecheck
- cd app && npm run gen:api:check
- cd app && npm run test
- cd app && npm run build

Backend (run when `backend/**` changed):

- cd backend && uv run ruff check .
- cd backend && uv run ruff format --check .
- cd backend && uv run pyright
- cd backend && uv run pytest -q

**These lists mirror `.woodpecker/backend.yml` and `.woodpecker/frontend.yml`
step-for-step. Keep them in sync — a gate CI runs and this file omits is a
ticket that passes locally and reddens `main`.** That happened once
(2026-09-03, PV3/feat-0010): CI's `lint` step runs `ruff check .` *and*
`ruff format --check .`, this file listed only the first, and the merge went
red. Fixed in fix-0006.

Docs/tickets-only diffs: no gates beyond a clean `git status` after commit.

Dockerfiles and `.woodpecker/*.yml` have **no local gate** — this laptop has
no container runtime by design (never install one). The Woodpecker build on
push is their gate; the PR body must say "image build verified in CI only".

## Substrates

| Substrate | Probe | Notes |
|---|---|---|
| unit | `cd app && npm run test` · `cd backend && uv run pytest -q` | always available; prefer it. SQLite-only on the backend — Postgres-only paths are `ci` |
| ci | Woodpecker API for the pushed SHA (`woodpecker` skill): `backend`, `frontend`, `docker` workflows | needs the push pipeline green for the current `main` SHA — check the *push* build, not the last PR build |
| deployed | `curl -fsS https://soundings-dev.k8s.bittern-chameleon.dev/api/healthz`; pod-side via `ssh dev-workshop kubectl -n soundings-dev …` | the dev slot rolls ~3–5 min after a merge to main (same images as prod until OPS1) |
| local (e2e) | `node -e "require('playwright-core')"` from `app/` + `ls /Applications/Google\ Chrome.app` | **UP since 2026-09-02.** Playwright's *bundled* browsers are still not installed and must not be (disk rule), but `@playwright/test`/`playwright-core` 1.56.1 are already in `app/node_modules`, and `chromium.launch({ channel: 'chrome' })` drives the installed Google Chrome with **zero downloads** — verified: dev slot 200, Chrome 152, disk unchanged. Drive deployed-UI criteria with a scratchpad script resolving `playwright-core` against `app/package.json`. `npm run test:e2e` works on this laptop against the installed Google Chrome with no downloads, because `playwright.config.ts` pins `channel: 'chrome'` (FX2, fix-0004). Cost depends entirely on whether a dev server is already up with a warm Vite cache: **~60s warm**, **11-17 min cold** (Vite dep optimization + Verovio WASM compilation on first load). Measured three times: 16.5m cold, 59.4s warm (server still running from the previous run), 11.0m cold again. Budget the cold number unless you know a dev server is live. Cheap enough to run on any ticket touching `app/src/views/**` or `app/src/styles/**`. |
| hardware | none — attended: a real MIDI keyboard / mic in desktop Chrome | never an admission input: lines tagged `hardware` are verify notes, not gates |
| H | human ratification = the PR merge | F tickets only; never auto-picked |

The laptop cannot reach Garage (no S3 hostname by design): every
Garage-touching criterion is `deployed`.

## Verify

- Frontend-visible changes: `cd app && npm run dev` and drive the affected
  view (verify skill). Playwright e2e (`app/e2e/`) only where the substrate
  is up.
- Backend runtime: `uv run pytest` covers the SQLite path locally; the
  Postgres path is `ci` (OPS2) / deploy-verified — say so in the PR body.
- Deployed-surface verification (post-gitops): from dev-workshop
  (`ssh dev-workshop kubectl …`), per `docs/deploy-k3s.md`; laptop browser
  checks use the tailnet host-mapping pattern from the homelab-access skill.

## Merge policy

Gates ratify — the loop merges its own green PRs; bookkeeping commits
straight to main. Exceptions: none.

**Green means CI too. Never merge a PR whose pipeline has not finished.**
Local gates and CI are not the same set (they drifted once — see Gates
above), so a locally-green branch can be red on the server. Poll the
pipelines for the branch SHA and merge only when every one has succeeded;
`pending`/`running` is not a licence to merge. (2026-09-03: PV3's #20 was
merged while branch pipelines #43/#44 had *already failed*, putting a red
commit on `main` that fix-0006 had to clean up.)

## Constraints

- **Forge = Gitea.** Branches and PRs go to the `gitea` remote
  (`git.bittern-chameleon.dev/nick-b/music-practice-app`). `origin` (GitHub)
  is the public showcase mirror: never push work branches there; the
  Gitea→GitHub main sync stays a deliberate human step.
- **Showcase isolation (sev-0 rule):** never couple homelab CI/CD to the
  Cloudflare Pages build (`.github/workflows/deploy-frontend.yml` and
  `app/wrangler.jsonc` are out of scope for every ticket in this queue).
  The public build must keep `VITE_API_BASE_URL` unset, and every
  backend-facing surface gates on `backendEnabled` (`config.test.ts`).
- **Disk discipline:** no Docker, no embedded-DB test clusters, no
  browser binaries, no non-trivial downloads on this laptop. Heavy work
  belongs on the homelab.
- **Contract chain:** any backend schema change regenerates
  `backend/openapi.json` (`uv run python scripts/export_openapi.py`) and
  `app/src/api/schema.d.ts` (`npm run gen:api`) in the same PR.
- **Alembic:** one linear chain; a new revision's number and
  `down_revision` come from `alembic heads` on `main` at PR time (grooming
  docs say `<next>_<name>`, never a fixed number); rebase and renumber on
  conflict. The chain now runs locally end-to-end on SQLite (`alembic
  upgrade head` / `downgrade base` / `upgrade head` all exit 0 against a
  file-backed `sqlite+pysqlite` database) — a future migration ticket
  should verify its own round-trip locally this way instead of
  substituting something weaker.
- **Cross-repo tickets** (a `**Repo:**` other than this one) are claimed in
  the owning repo per its own conventions — homelab_infra_and_planning
  enforces worktrees and has its own numbering; homelab-gitops follows the
  litholens chart layout. Gates for those tickets come from that repo, not
  this file. Record the claimed branch back in this repo's grooming doc.
  This loop cannot dep-check them: consumers carry a `deployed` criterion
  against the service so admission blocks honestly.
- **Landing (progress-or-death, global CLAUDE.md 2026-07-11):** gates
  ratify; humans steer post-hoc. Code changes go branch → PR (for the
  record/review trail) → merged by the loop itself (gitea MCP merge —
  the Bash path trips the auto-mode classifier). Ticket bookkeeping
  (status flips, work_history, grooming marks, this file) commits directly
  to main. Never schedule wake-ups to wait for a human action: if only a
  human can feed the loop, terminate — final report, push notification,
  monitors stopped. The human relaunches after acting.
- **H steps:** attempt them attended first (secret values staying in shell
  vars, never in context). Only if genuinely blocked (classifier/hook
  denial) does the step become human-only — then it must not idle the
  loop: post the exact command in the ticket Notes, push-notify, and
  terminate if nothing else is eligible.
- **Delegation:** implementation is dispatched to a subagent at the
  ticket's tier (§Model routing); gates always run in the orchestrating
  session — never trust a subagent's self-reported gate result.

## Model routing

Tier stamps on tickets are routing data, enforced at dispatch.

- Default tier: T1 (sonnet)
- T0 (haiku): SC6
- T1 (sonnet): SB4, SB5, SB6, SB8, PV4, PV5, RC1, RC3, RC5, RC7, OPS1, OPS2, SC5, SC7, SR4, SR7
- T2 (sonnet, high effort): MD1, SB1, SB2, SB3a, SB3b, SB7, PV1, PV2, PV3, RC2, RC4, RC6, SC2, SC3, SC4, SC8, SC9, SR5, SR6, SR8
- T3 (opus): SC1, SR1, SR2, SR3
- F (frontier, human-dispatched, never auto-picked): F1, F2 — reviewed 2026-09-02 (docs-0006; done at merge)
- Legacy tags in `_grooming-k3s-onboarding.md` (all done): S = T1, O = T3, H = H.
- Never auto-escalated past T3; frontier-class work is human-scheduled.

## Queue

- .tickets/_grooming-sketchbook-and-media.md
- .tickets/_grooming-k3s-onboarding.md (done — kept for the record)
