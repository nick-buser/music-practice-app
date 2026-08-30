# feat-0002 — Soundings k3s rollout (T4)

Closed out the k3s onboarding effort. Both slots serving; runbook in
`docs/deploy-k3s.md`.

## What landed

- `docs/deploy-k3s.md` — architecture, env inventory, the deploy loop, five
  rough edges with recovery moves, verification performed, known-open list.
- `fix: make docker-entrypoint.sh executable` — git mode 100644 → 100755 plus
  a defensive `RUN chmod +x` in `backend/Dockerfile`.
- `fix(ci): let docker.yml be triggered manually (fix-0002)` — two OR'd
  `when:` conditions so a manual trigger is not filtered out by `path`.

Cross-repo (homelab-gitops): `service-0373` (chart, two slots, SOPS secrets,
Kyverno namespaces), `fix-0375` (the wave-wedge fix), `service-0376`
(chart-check hardening + the wave lint).

## Verified

Migrate Jobs green against both NAS databases; SPA and `/api/healthz` 200 on
both hosts; `/api/v1/chords` round-trips through the StripPrefix middleware;
data survives an api pod deletion; dev slot's database is genuinely separate;
and the full push→build→Image Updater→Argo loop closed with no human step.

## Found along the way

- The api container had **never been run** before this deploy. The migrate Job
  overrides `command:`, bypassing the ENTRYPOINT, so a broken entrypoint bit
  passed every check including a green migration against production data.
- Argo's Ingress health check never goes healthy on this cluster, which makes
  sync-waves a trap rather than a tool. Now linted in the gitops repo.
- `chart-check.sh` had two silent false-greens (absent kyverno; wrong yq
  flavour) — a gate can be worse than no gate if it reports green while
  checking nothing.
