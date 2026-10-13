---
title: Update the Linear identity to Rheged Studio
release_note: Points this repo's Linear configuration at the renamed Rheged Studio team and rheged-studio workspace, restoring Linear writeback for the linear-sync, triage-pr, cleanup-repo and send-it skills.
created_at: '2026-08-04T16:59:23Z'
merged_at: '2026-08-04T17:24:47Z'
branch: a-1224-agent-skills-linear-identity-at-source
pr: 155
commit: ff04e07
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - R-1224
stats:
  files_changed: 90
  loc_added: 215
  loc_removed: 169
  commits: 3
version: 1.4.0
---

## Changed

- **Linear team name and workspace slug ([R-1224](https://linear.app/rheged-studio/issue/R-1224)).**
  The estate rebranded from ACME Skunkworks to Rheged Studio. The Linear team was
  renamed first and the workspace URL key followed, but this repo still resolved the
  team by its old name — so every Linear writeback (`linear-sync`, `triage-pr`,
  `cleanup-repo`, and `send-it` through them) got a 400 from `save_issue`. Updates the
  tracked source of truth under `infrastructure/dogfood-config/`, the repo-root
  `config.json` that `changelog-core` reads, the config-table example values shipped
  to consumers, and the `fleet-deployment` worked example. The `A` issue prefix is
  unchanged.

- **Bundle versions.** `cleanup-repo` `0.4.0` → `0.4.1` and `linear-sync` `0.3.3` →
  `0.3.4` — patch bumps per [ADR-0001](../architecture/0001-skill-layout.md)
  Decision 2, since the `SKILL.md` consumers receive changes but its behaviour does
  not.

- **Committed Linear URLs.** Repointed 68 changelog entries plus `CLAUDE.md`,
  `README.md` and two ADRs at the `rheged-studio` workspace. Linear redirects old
  workspace URLs, so none of these links were broken — this is hygiene rather than
  repair, and the substitution touched the URL only, leaving the immutable ADRs'
  prose intact.

This is the first of sixteen repos in the estate-wide Linear identity fan-out; the
doc tables here are the source every consumer's vendored copy shows.
