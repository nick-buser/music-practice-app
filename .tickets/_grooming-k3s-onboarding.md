---
title: Homelab k3s onboarding (grooming)
status: open
---

## Context

Grooms the infra-provisioning-and-deployment effort for Soundings onto the
homelab k3s GitOps platform (Argo CD + Image Updater + Woodpecker + SOPS),
per Nick's 2026-07-11 direction: k3s path chosen over Dokploy; shared NAS
Postgres + Garage explicitly wanted; knowledge-mapping/crucible integration
deferred.

**Source material:** the infra repo's `k3s-app-onboard` skill
(`homelab_infra_and_planning/.claude/skills/k3s-app-onboard/SKILL.md`), the
litholens first-tenant runbook + rough-edges log
(`multidimensional-image-viewer/docs/deploy-k3s.md`), the contract files
(`app-db-contracts.yml`, `nas-services-setup.yml`), and `DEPLOYMENT.md` here.

**Audit method:** live checks against the cluster (`ssh dev-workshop
kubectl`), Gitea (`list_my_repos`, both pages), DNS/Caddy probes, and reads
of every file named in the tickets below. Verified 2026-07-11:

- **No Gitea repo exists for this project** — `origin` is GitHub only
  (`nick-buser/music-practice-app`). The `.woodpecker/*.yml` files here have
  never run: Woodpecker only builds from Gitea. Forge onboarding is step 0.
- **No DB contract, no Garage bucket, no vault keys** exist for this app in
  the infra repo (greenfield).
- **Shared substrate is live**: NAS Postgres (`pgvector/pgvector:pg16`) and
  Garage v1.1.0 on `pve`; contract pipeline (`labctl contracts scaffold` →
  `labctl deploy nas-services`) proven by knowledge-mapping et al.
- **k3s cluster healthy** (server node); litholens + reading-list are prior
  tenants. Litholens deliberately ran Postgres+MinIO **in-namespace** (blast
  radius, PostGIS extension, MinIO anon-policy semantics) and deferred
  shared-substrate use as follow-up. Soundings needs no extensions and no
  anonymous buckets → it is the right first tenant for shared NAS
  Postgres + Garage from k3s. **This is precedent-setting; if pod→NAS
  egress is blocked (netpol), fallback is the litholens in-namespace
  pattern.**
- `backend/Dockerfile` is already production-shaped (uv multi-stage,
  non-root, `/healthz` healthcheck, gunicorn; entrypoint runs Alembic then
  serves). There is **no web image** (SPA is Cloudflare-Pages-built only)
  and **no `.woodpecker/docker.yml`**.
- `app/src/config.ts` gates every backend feature on `VITE_API_BASE_URL`;
  the value is baked at build time. Empty/unset = the public static shape.
- Hard boundary honored throughout: the Cloudflare Pages showcase (GitHub
  Actions) is untouched by all of this — homelab CI never couples to it.

Proposed numbers are next-available as of 2026-07-11; `/branch-new`
recomputes at claim time — clashes harmless. Cross-repo tickets get claimed
in their owning repo with that repo's numbering.

**Naming decision (default chosen, cheap to override):** app slug is
**`soundings`** everywhere infra-facing — images `soundings-api`/
`soundings-web`, chart `charts/soundings`, namespace `soundings`, buckets
`soundings-{dev,prod}`, vault `vault_soundings_*`, host
`soundings.k8s.bittern-chameleon.dev`. The Gitea repo keeps the name
`music-practice-app` to match GitHub and the local checkout (litholens
precedent: repo name ≠ app slug is fine).

## Ticket 1 — feat-0001: Forge onboarding + container images + docker CI

**Repo:** music-practice-app (this repo)
**Why:** Nothing can deploy until images exist in the Gitea registry and
Woodpecker builds them. The repo isn't even on the forge yet.
**Scope / surfaces / files:**
- *Pre-steps (operational, no diff):* create `nick-b/music-practice-app` on
  Gitea (private), add `gitea` remote here, push `main`; activate the repo
  in Woodpecker via API (`POST /api/repos?forge_remote_id=<id>`) and set
  repo secrets `gitea_username`/`gitea_token` (value: vault
  `gitea_registry_push_token`) — token write is operator-gated; hand Nick
  the exact curl.
- `app/Dockerfile.web` + nginx conf: multi-stage `node:22` build
  (`VITE_API_BASE_URL=/api` build arg) → nginx static image with SPA
  fallback (`try_files ... /index.html`).
- `backend/docker-entrypoint.sh`: make the migration step opt-in via env
  (e.g. `RUN_MIGRATIONS`, default on for compose parity, off in-cluster —
  the chart's migrate Job owns schema; litholens rough edge #2).
- `.woodpecker/docker.yml`: two `woodpeckerci/plugin-docker-buildx` steps
  (`soundings-api` from `backend/`, `soundings-web` from `app/`), registry
  `git.bittern-chameleon.dev`, tags `${CI_COMMIT_SHA:0:8}` + `latest` (that
  form is proven in plugin settings only — never in `commands:`).
- Backend CORS: confirm `settings.cors_origins` accepts env override; in
  prod same-origin makes it moot, keep the Vite-dev entry.
**Decision needed:** none blocking. (Origin-flip — making Gitea `origin` and
GitHub a `github` mirror remote per house pattern — deferred; GitHub Actions
Pages deploy keys off GitHub pushes today, so leave `origin` alone for now.)
**Acceptance criteria:**
- [ ] Repo visible at `git.bittern-chameleon.dev/nick-b/music-practice-app`,
      existing `frontend.yml`/`backend.yml` checks run and pass.
- [ ] First green `docker.yml` build pushes `soundings-api:<sha8>` and
      `soundings-web:<sha8>` to the Gitea registry; sha8 recorded for T3.
- [ ] `docker run soundings-web` serves the SPA with backend features
      compiled in (`/api` base); api image unchanged in behavior locally.

## Ticket 2 — infra-####: Substrate contract — Postgres, Garage, vault

**Repo:** homelab_infra_and_planning (claim with its numbering; PR from a
worktree per its enforced workflow)
**Why:** The app needs a database and object storage that exist before the
chart references their credentials. Recordings + sheet scans are personal
media → per-env scoped Garage keys, off the shared `homelab-main` grant loop
(document-life precedent, service-0137).
**Scope / surfaces / files:**
- `ansible/inventory/group_vars/all/app-db-contracts.yml`: six rows
  (`soundings` × dev/prod × rw/app/ro).
- `docs/workbench-projects.yml`: register the project.
- `ansible/playbooks/nas-services-setup.yml`: buckets `soundings-dev`,
  `soundings-prod` (bucket loop) + scoped key import + per-bucket grants,
  copying the `document-life-{env}` blocks.
- Ops: `scripts/labctl contracts scaffold` (mints
  `vault_soundings_{dev,prod}_{rw,app,ro}_db_*`), `scripts/labctl vault set`
  for the two Garage keypairs, commit `vault.yml` immediately, then
  `scripts/labctl deploy nas-services --force`.
**Acceptance criteria:**
- [ ] `psql` as each role connects; `soundings_dev` DB owned by `rw`, `app`
      role is DML-only.
- [ ] Both buckets exist; each scoped key lists/reads/writes only its own
      bucket; `homelab-main` cannot reach either.
- [ ] Vault keys committed; no plaintext secret in any diff.

## Ticket 3 — gitops: Helm chart + Argo Application + SOPS secret + Kyverno

**Repo:** homelab-gitops (branch per its convention)
**Why:** The GitOps half — everything Argo needs to run and auto-roll the
app.
**Scope / surfaces / files:**
- `charts/soundings/`: api Deployment (+ probes on `/healthz`, cpu+mem
  requests, mem limits), web Deployment (nginx), Services, single Ingress
  (`soundings.k8s.lab` + `soundings.k8s.bittern-chameleon.dev`; `/` → web,
  `/api` → api with a Traefik StripPrefix middleware), migrate Job running
  `alembic upgrade head` from the api image — **Sync hook, NEVER PreSync**
  (first-install deadlock; skill rule), sync-wave before the app tier.
  No PVCs: state lives in NAS Postgres + Garage.
- App env (via SOPS secret + values): `DATABASE_URL` → NAS Postgres
  `soundings_dev` **app** role (dev creds first, litholens parity; prod slot
  reserved); migrate Job gets the **rw** DSN; `S3_ENDPOINT`
  `http://192.168.1.12:3900`, bucket `soundings-dev`, scoped key;
  `ENV=prod` so the lifespan skips `create_all` and Alembic owns schema.
- `secrets/soundings/app-secrets.sops.yaml` (encrypt via the in-cluster
  cmp-sops sidecar — no local sops needed) + `infra/soundings-secrets.yaml`
  Application. Values master-of-record: vault (T2).
- `apps/soundings.yaml`: Argo Application + Image Updater annotations
  (watch api+web; `allow-tags: regexp:^[0-9a-f]{7,40}$`,
  `write-back-target: helmvalues:values.yaml`, git write-back secret).
- `policies/require-requests-limits.yaml` (1 block) +
  `policies/disallow-latest-tag.yaml` (2 blocks): add `soundings`.
**Decision needed:** none blocking. (`/api` StripPrefix chosen over baking
the absolute public origin into the web build — keeps the image
hostname-agnostic; flip to absolute origin if the middleware fights us.)
**Acceptance criteria:**
- [ ] First deploy pins the T1 sha8s (never placeholder/`latest` — wave-wedge
      trap, litholens rough edge #13).
- [ ] Migrate Job completes; api/web pods Ready; Kyverno admits the
      namespace with zero Enforce violations.
- [ ] **Precedent check:** api pod reaches NAS Postgres and Garage from
      in-cluster (first tenant to do so — if blocked, escalate before
      falling back to in-namespace Postgres).
- [ ] `https://soundings.k8s.bittern-chameleon.dev` serves the SPA; a
      backend-gated feature (saved chords) round-trips through `/api`.

## Ticket 4 — feat-0002: Rollout verification + deploy doc

**Repo:** music-practice-app (this repo)
**Why:** Close the loop end-to-end and leave the runbook the next change
rides on (litholens' deploy doc is the model).
**Scope / surfaces / files:**
- Verify from dev-workshop (cluster API is LAN-only for laptop tools):
  pods/Job green, Playwright/e2e against the public URL with the tailnet
  host-mapping pattern (`--host-resolver-rules=MAP *.k8s.bittern-chameleon.dev
  100.66.37.70`); expect the macOS negative-DNS-cache edge on first probe.
- Loop test: trivial commit to main → Woodpecker sha8 → Image Updater
  write-back commit on homelab-gitops → Argo auto-roll, no human step.
- `docs/deploy-k3s.md` in this repo: architecture, env inventory, rough
  edges encountered, recovery moves used.
**Acceptance criteria:**
- [ ] Loop test passes within ~5 min (3-min Argo poll accepted; no webhook).
- [ ] Saved-chords create/read persists across a pod restart (data really in
      NAS Postgres).
- [ ] Deploy doc merged.

## What is already done (so we don't relitigate)

- **api Dockerfile**: production-shaped (uv, non-root, healthcheck,
  gunicorn) — reuse as-is apart from the migration-flag tweak.
- **Backend**: FastAPI + Alembic + `/healthz` + OTel→SigNoz hooks +
  env-driven config, Postgres-ready. Sessions/chords models + CRUD exist.
- **Check CI**: `.woodpecker/{frontend,backend}.yml` are written and will
  start running the moment the Gitea repo exists.
- **Two-shape discipline** (`DEPLOYMENT.md`, `config.ts` + its test): the
  public Cloudflare build stays backend-free; this effort deploys the *full*
  shape on the homelab and changes nothing about the showcase.
- **Substrate**: NAS Postgres, Garage, contract tooling, k3s GitOps flow —
  all live and proven by prior tenants.

## Suggested ordering

T1 and T2 are independent — run in parallel. T3 needs both (sha8s from T1,
vault creds from T2). T4 rides T3. Merge order within T3 is load-bearing:
app-repo PR merged and green **before** the gitops PR (pin real sha8s, never
placeholders).

## Notes (dogfooding)

- Three-repo effort, three numbering schemes; per the tasks-as-files rule
  each ticket claims in its owning repo and this doc is the cross-repo
  index. Friction: nothing links back automatically — claimed-branch names
  get recorded here by hand.
- `.tickets/` bootstrapped by this PR (repo had none).
