---
title: ticket-loop config
---

## Gates

Frontend (run when `app/**` or `backend/openapi.json` changed):

- cd app && npm run typecheck
- cd app && npm run gen:api:check
- cd app && npm run test
- cd app && npm run build

Backend (run when `backend/**` changed):

- cd backend && uv run ruff check .
- cd backend && uv run pyright
- cd backend && uv run pytest -q

Docs/tickets-only diffs: no gates beyond a clean `git status` after commit.

Dockerfiles and `.woodpecker/*.yml` have **no local gate** — this laptop has
no container runtime by design (never install one). The Woodpecker build on
push is their gate; the PR body must say "image build verified in CI only".

## Verify

- Frontend-visible changes: `cd app && npm run dev` and drive the affected
  view (verify skill). Playwright e2e (`app/e2e/`) where a spec covers it.
- Backend runtime: `uv run pytest` covers the SQLite path locally; the
  Postgres path is CI/deploy-verified only — say so in the PR body.
- Deployed-surface verification (post-gitops): from dev-workshop
  (`ssh dev-workshop kubectl …`), per feat-0002; laptop browser checks use
  the tailnet host-mapping pattern from the homelab-access skill.

## Constraints

- **Forge = Gitea.** Branches and PRs go to the `gitea` remote
  (`git.bittern-chameleon.dev/nick-b/music-practice-app`). `origin` (GitHub)
  is the public showcase mirror: never push work branches there; the
  Gitea→GitHub main sync stays a deliberate human step.
- **Showcase isolation (sev-0 rule):** never couple homelab CI/CD to the
  Cloudflare Pages build (`.github/workflows/deploy-frontend.yml` and
  `app/wrangler.jsonc` are out of scope for every ticket in this queue).
  The public build must keep `VITE_API_BASE_URL` unset.
- **Disk discipline:** no Docker, no embedded-DB test clusters, no
  non-trivial downloads on this laptop. Heavy work belongs on the homelab.
- **Cross-repo tickets** (a `**Repo:**` other than this one) are claimed in
  the owning repo per its own conventions — homelab_infra_and_planning
  enforces worktrees and has its own numbering; homelab-gitops follows the
  litholens chart layout. Gates for those tickets come from that repo, not
  this file. Record the claimed branch back in this repo's grooming doc.
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
- **Delegation:** implementation may be delegated to subagents routed by the
  ticket's tier tag (S → sonnet-class, O → opus-class, default → session
  model); gates always run in the orchestrating session — never trust a
  subagent's self-reported gate result.

## Queue

- .tickets/_grooming-k3s-onboarding.md
