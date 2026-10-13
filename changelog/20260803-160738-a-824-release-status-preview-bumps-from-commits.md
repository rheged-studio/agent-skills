---
title: 'release-status: preview bumps from commits since last tag (R-824)'
release_note: release-status version preview now ranks Conventional-Commit subjects on commits since the last tag (merge commits excluded), matching release-please under multi-commit history.
created_at: '2026-08-03T16:07:38Z'
merged_at: '2026-08-03T16:35:17Z'
branch: a-824-validate-release-please-bump-derivation-under-multi-commit
pr: 144
commit: 27d4509
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-824
stats:
  files_changed: 6
  loc_added: 257
  loc_removed: 134
  commits: 4
version: 1.4.0
---

## Added

- **`release-status`:** version preview reads **commits since the last tag** on
  the configured trunk (`git log <tag>..origin/<mainBranch> --no-merges`) instead
  of merged PR titles, so the advisory bump matches release-please 17.9.0 under
  multi-commit (non-squash) history
  ([R-824](https://linear.app/rheged-studio/issue/R-824)). Evaluating against
  `origin/<mainBranch>` (not local `HEAD`) keeps the preview aligned with the
  trunk even when the helper is run from a feature branch.

## Changed

- Strongest-type ranking is unchanged (`feat`→minor, `fix`/`perf`/`revert`→patch,
  `!`/`BREAKING CHANGE:`→major; docs/chore/…→none). **Policy:** a `feat:` later
  `revert:`ed in the same window still implies **minor** — no cancel/netting —
  matching release-please's `DefaultVersioningStrategy`. Merge-commit subjects are
  excluded so a merge body's PR title is not double-counted against branch commits.
- Report JSON field `mergedPrCount` → `commitCount`; human copy updated accordingly.
- Skill bundle bumped `0.1.5` → `0.2.0`.
