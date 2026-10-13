---
title: fleet-update.mjs vendors from the GitHub URL, not a local path
release_note: fleet-update.mjs installed the shared bundles from the local agent-skills checkout path, and the skills.sh CLI writes that source into the consumer's committed skills-lock.json — so a fan-out run leaked an absolute machine path and sourceType:local into every consumer. It now vendors from the canonical GitHub URL, so the lockfile records sourceType:github with no path. The local checkout stays as the check-updates --source only.
created_at: '2026-07-06T17:20:00Z'
merged_at: '2026-07-06T17:37:56Z'
branch: a-718-fleet-updatemjs-installs-from-a-local-path-leaking-an
pr: 108
commit: fa4b72f
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-718
stats:
  files_changed: 4
  loc_added: 102
  loc_removed: 63
  commits: 5
version: 1.2.0
---

## Fixed

`infrastructure/scripts/fleet-update.mjs` ([R-617](https://linear.app/rheged-studio/issue/R-617)) installed the shared bundles with
`skills add <local-checkout-path> --copy`. The skills.sh CLI records whatever source
it was given verbatim in the consumer's **committed** `skills-lock.json`, so a
fan-out run wrote an absolute machine path plus `sourceType: local` into every
consumer — leaking the orchestrator/operator's filesystem layout and pinning the
consumer's provenance to an ephemeral CI checkout path. (This is the CLI's own
`skills-lock.json`, distinct from our `.claude/skills.lock`, which already recorded
the GitHub URL correctly.)

The install now vendors from the canonical GitHub URL (`SOURCE_URL`), so the
lockfile records `source: acme-skunkworks/agent-skills` + `sourceType: github` with
no path. The local checkout stays as the `check-updates --source` only — a local
checkout is needed to read target versions — so the install source (URL) and the
verify source (local checkout) are now distinct roles. A URL install resolves the
default branch, which is what the recurring roll-onto-latest fan-out wants; the
pinned/bootstrap path stays the runbook's local-clone approach.

Found immediately after [R-617](https://linear.app/rheged-studio/issue/R-617) (#107) merged.
