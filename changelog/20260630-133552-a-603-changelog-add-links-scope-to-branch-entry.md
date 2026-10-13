---
title: changelog add-links scopes to the current branch's entry by default
release_note: 'The changelog skill''s add-links.mjs, which linkifies bare Linear issue IDs in entry bodies, now scopes its default write pass to the entry(ies) whose branch: frontmatter matches the current git branch. Previously it rewrote every entry in the changelog directory on every run, so authoring a new entry could churn unrelated, already-merged entries (any historical entry with a bare ID), which the author then had to manually revert before committing. A new --all flag runs the historical full-directory sweep; --check stays whole-directory (it''s a completeness gate); and when git is unavailable the default falls back to the full sweep. Also linkifies a stale bare R-369 in the R-541 entry that had been re-triggering the churn.'
version: 1.2.0
created_at: '2026-06-30T13:35:52Z'
merged_at: '2026-06-30T13:46:15Z'
branch: a-603-changelog-add-links-scope-to-branch-entry
pr: 82
commit: 9c004f1
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-603
stats:
  files_changed: 6
  loc_added: 148
  loc_removed: 14
  commits: 3
---

## Changed

- **`add-links.mjs` scopes to the current branch's entry by default
  ([R-603](https://linear.app/rheged-studio/issue/R-603)).** The script that linkifies
  bare Linear issue IDs in changelog bodies previously rewrote **every** entry in the
  directory on every run. Because any historical entry with an un-linkified ID would be
  rewritten as collateral, authoring a new entry churned unrelated, already-merged files —
  which the author (or send-it) had to manually `git checkout --` before committing. The
  default write pass now rewrites only the entry(ies) whose `branch:` frontmatter matches
  the current git branch (via a new `frontmatterBranch()` helper).

## Added

- **`--all` flag** for the deliberate full-directory rewrite. `--check` / `--dry-run` keep
  scanning the whole directory (the completeness gate), and a non-git context falls back to
  the full sweep, so nothing that relied on the old behaviour loses it.

## Fixed

- Linkified a stale bare `R-369` in the `R-541` changelog entry that had been re-triggering
  the cross-entry churn on every `add-links` run.

- The `changelog` bundle bumps to `0.8.0`.
