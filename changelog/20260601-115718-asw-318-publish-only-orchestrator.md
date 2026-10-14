---
title: "Adopt the publish-only orchestrator model and harden CI"
release_note: "Reworks release.yml to a publish-only, orchestrator-driven model and adds yaml-lint and infra CI gates."
version: "0.0.1"
created_at: "2026-06-01T11:57:18Z"
merged_at: "2026-06-01T12:28:14Z"
branch: "asw-318-upgrade-agent-skills-release-pipeline-to-match-eslint-config"
pr: 12
commit: "675cf44"
merge_strategy: squash
author: "rob@acmeskunkworks.io"
co_authors: []
category: chore
breaking: false
issues: ["R-318", "R-315"]
stats:
  files_changed: 15
  loc_added: 911
  loc_removed: 46
  commits: 11
---

## Changed

- Reworked `release.yml` to publish-only: dropped `workflow_dispatch` and the version-PR inputs (the private road-runner-bot `release-orchestrator` now owns versioning), added a pending-changeset detection gate, a branch-restricted `npm-release` environment, an idempotent tag/release step, and a release-failure issue notifier.
- Gated all four `@claude` triggers on `author_association`.
- Rewrote the `CLAUDE.md` Release section for the publish-only flow, the required-check contract, and the out-of-band operator setup.

## Added

- The required `🔬 Build & Lint` check plus `yaml-lint` (digest-pinned yamllint + actionlint) and `infra` (shellcheck + bats) jobs in `validate.yml`, and a new `infrastructure/` tree (hash-locked tool installers, `.yamllint.yml`, and bats coverage of both publish scripts).
