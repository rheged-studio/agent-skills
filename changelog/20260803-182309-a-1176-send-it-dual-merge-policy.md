---
title: 'send-it: dual merge policy — feature merge commits, release/fan-out squash (R-1176)'
release_note: send-it documents and uses merge commits for feature PRs while release-please and fan-out PRs stay squash; derive-bump excludes merge subjects from the pre-merge scan.
created_at: '2026-08-03T18:23:09Z'
merged_at: '2026-08-03T20:02:48Z'
branch: a-1176-update-send-it-derive-bump-claudemd-adr-for-merge-commits
pr: 148
commit: 06b0dd7
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-1176
stats:
  files_changed: 13
  loc_added: 236
  loc_removed: 94
  commits: 4
version: 1.4.0
---

## Added

- **ADR-0005** documents the dual merge policy: feature/ship PRs → merge commits;
  release-please version PRs and fan-out PRs → squash; both merge methods stay
  allowed ([R-1177](https://linear.app/rheged-studio/issue/R-1177)); Commitlint /
  validate-commits as the commit-subject prerequisite
  ([R-823](https://linear.app/rheged-studio/issue/R-823) /
  [R-983](https://linear.app/rheged-studio/issue/R-983)).

## Changed

- **`send-it`:** replace squash-only / “PR title is the bump signal” wording with
  the dual policy; `--merge-when-ready` now enables `gh pr merge --auto --merge`;
  Step 6 keeps a Conventional Commits PR title for CI and humans while feature-PR
  bumps after merge come from landed commit subjects
  ([R-824](https://linear.app/rheged-studio/issue/R-824)); dominant type across
  commits ([R-387](https://linear.app/rheged-studio/issue/R-387)). Bundle bumped
  `0.6.2` → `0.7.0`.
- **`derive-bump` / `git.mjs`:** `git log --no-merges` so merge subjects are not
  mixed into the pre-merge bump scan; header comments updated for [R-1176](https://linear.app/rheged-studio/issue/R-1176).
- **CLAUDE.md**, root README, and ADR-0003 amended for the same policy (orchestrator
  still squash-merges the release PR).
