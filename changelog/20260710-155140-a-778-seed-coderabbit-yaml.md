---
title: Seed estate .coderabbit.yaml
release_note: agent-skills now carries the estate `.coderabbit.yaml` as a repo-owned copy (R-778).
created_at: '2026-07-10T15:51:40Z'
branch: a-778-remove-the-coderabbityaml-fan-out-from-fanout-configyml
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - R-778
merged_at: '2026-07-10T16:30:33Z'
commit: dccc825
pr: 124
stats:
  loc_added: 73
  loc_removed: 0
  files_changed: 2
  commits: 1
version: 1.2.5
---

## Added

- Repo-root `.coderabbit.yaml` seeded from the estate reference profile
  ([R-778](https://linear.app/rheged-studio/issue/R-778)). The file is
  repo-owned — the orchestrator no longer fans it out.
