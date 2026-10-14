---
title: Fail closed when skills mint Linear issues without a project
release_note: triage-pr and preflight refuse to create Linear issues without a resolved project; initialise-skills stops treating an empty followUpProject as intentional.
created_at: '2026-08-04T20:12:23Z'
branch: a-1204-fail-closed-when-skills-mint-linear-issues-without-a-project
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-1204
merged_at: '2026-08-04T20:38:25Z'
commit: 9d2c5d6
pr: 157
stats:
  loc_added: 192
  loc_removed: 58
  files_changed: 17
  commits: 6
version: 1.4.0
---

## Changed

- **triage-pr `0.10.2` → `0.11.0` ([R-1204](https://linear.app/rheged-studio/issue/R-1204)).**
  When follow-up capture is enabled (`linearTeamName` set), `followUpProject` is
  required. Empty or unresolved project aborts capture (decline / not-tracked
  fallback) instead of filing with no project. Dogfood sets
  `followUpProject: "Agent Skills"`.

- **preflight `0.2.1` → `0.3.0`.** Exit 2 **Defer** now has an explicit debt-create
  contract: root `preflight.config.json` keys `linearTeamName` + `debtProject`,
  resolve via `list_projects`, refuse `save_issue` without a resolved project.
  `list_projects` added to allowed-tools.

- **initialise-skills `0.10.10` → `0.11.0`.** `followUpProject` detector reads
  `facts.followUpProject`; when `linearTeamName` is set and no project fact is
  supplied it returns `needs-manual-input` instead of a confident empty "no
  project". Fleet install profiles forward `facts.followUpProject`.

Consumer re-vendor / per-repo `followUpProject` values remain a fleet fan-out
after this lands.
