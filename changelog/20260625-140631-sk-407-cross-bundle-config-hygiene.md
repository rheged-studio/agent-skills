---
title: Cross-bundle config hygiene across the shared skills
release_note: Fixes a cleanup-repo issueKeys gap, ships triage-pr's missing config.example.json and aligns its default review bots with config, adds the Read tool to cleanup-repo/linear-sync, and removes stale changeset references — closing out the R-407 de-bespoking.
created_at: '2026-06-25T14:06:31Z'
merged_at: '2026-06-25T14:26:44Z'
branch: sk-407-cross-bundle-config-hygiene
pr: 35
commit: '0164538'
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-407
affected_packages:
  - changelog
  - cleanup-repo
  - infrastructure
  - linear-sync
  - triage-pr
stats:
  files_changed: 16
  loc_added: 78
  loc_removed: 22
  commits: 3
version: 1.2.0
---

## Fixed

- **`cleanup-repo` issue-key drift.** `config.json` `issueKeys` was missing `SK`,
  which `changelog` and `linear-sync` already carry — so recent `SK-` branches
  weren't recognised for the Linear `Done` writeback. Added it (`0.1.1`).
- **`triage-pr` default review bots.** `review-threads.mjs` `DEFAULT_BOTS` included
  `github-actions`, contradicting both `config.json` and the SKILL.md note that it
  is deliberately excluded; dropped it so the script default matches config
  (`0.1.1`).

## Added

- **`triage-pr` `config.example.json`.** The only bundle that shipped without a
  config template now has one, satisfying the per-skill config-template contract.
- **`Read` in `allowed-tools`** for `cleanup-repo` (`0.1.1`) and `linear-sync`
  (`0.1.3`) — both instruct the agent to read their `config.json`, but neither
  granted the `Read` tool, forcing a `Bash(node:*)` workaround. Added to each
  SKILL.md and its `.claude/commands/*` shim.

## Changed

- **Removed stale `changeset` references** from the distributed bundles: the
  `changelog` package `keywords` (`0.2.1`), a `cleanup-repo` design-note, and two
  `triage-pr` SKILL.md examples (`pnpm changeset status`). The `send-it`
  references are accurate explanations of the post-changeset release-please model
  and were left as-is.
