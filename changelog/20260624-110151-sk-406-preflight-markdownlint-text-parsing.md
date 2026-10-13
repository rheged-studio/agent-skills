---
title: Fix preflight swallowing markdownlint violations
release_note: The preflight markdown gate now parses markdownlint-cli2's real output and surfaces violations instead of misreporting them as a linter that couldn't run; an absent markdownlint-cli2 now skips gracefully.
created_at: '2026-06-24T11:01:51Z'
merged_at: '2026-06-25T09:33:36Z'
branch: sk-406-preflight-markdownlint-format-json-fix
pr: 31
commit: 582cc27
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-406
affected_packages:
  - infrastructure
stats:
  files_changed: 6
  loc_added: 251
  loc_removed: 25
  commits: 4
version: 1.2.0
---

## Fixed

- **preflight no longer silently swallows markdown violations.** The markdown gate invoked `markdownlint-cli2 --format json`, but markdownlint-cli2 has no `--format`/JSON CLI flag — so it produced no parseable output and a non-zero exit with zero parsed violations was misreported as `failedLinters` ("linter couldn't run"). Real, introduced violations were dropped and the branch shipped anyway. preflight now parses markdownlint-cli2's default text output (`<file>:<line>[:<col>] [severity] <rule> <description>`) via a new `parseMarkdownlintText`, so violations are classified (introduced vs pre-existing) and surfaced like ESLint and actionlint.
- **An absent `markdownlint-cli2` now skips gracefully** instead of blocking. A genuinely-missing binary is now distinguished from a run that found violations: the former warns and skips (the same posture as `actionlint`), the latter surfaces violations. The `.preflight-summary.json` gains a `results.markdownlint` status (`ran` / `warn-skipped` / `skipped`).

## Changed

- Bumped the `preflight` bundle to `0.1.1`.
