---
title: 'derive-bump: derive the release type from all commits, not just HEAD'
release_note: Fixes /send-it under-deriving the release type on a branch whose HEAD commit is a chore/docs commit but which carries an earlier feat/fix. The bump, PR-title type, and changelog category are now taken from the strongest Conventional-Commit type across all commits — so a mixed branch ending on a non-release commit no longer silently fails to cut a release.
created_at: '2026-07-04T18:33:42Z'
merged_at: '2026-07-04T18:56:23Z'
branch: a-387-derive-bump-scan-all-commits-not-just-head-when-deriving-the
pr: 96
commit: bd54f22
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-387
stats:
  files_changed: 5
  loc_added: 199
  loc_removed: 17
  commits: 4
version: 1.2.0
---

## Fixed

**send-it:** `derive-bump.mjs` decided the `feat:`/`fix:` release-type signal from
only the **HEAD** commit (`commits[0]`, since `git log <base>..HEAD` is
newest-first), while breaking-change detection already scanned every commit. A
branch whose HEAD commit was a `chore:`/`docs:` commit but which carried an earlier
`feat:`/`fix:` was under-derived: `/send-it` composed a non-release PR title,
release-please cut nothing, and the fixes never published. Under release-please the
PR title **is** the release signal, so this silently mis-cut real releases — the
workaround was a manual `--title` override.

Both buggy paths — `deriveBump` (the release magnitude) and `deriveCategory` (the
[R-598](https://linear.app/rheged-studio/issue/R-598) `type` / `category` / `releaseTriggering` decision) — now derive from the
**strongest Conventional-Commit type across all commits** via a new
`deriveDominantType` helper (`feat` outranks `fix`/`perf`, which outrank the
non-release types). When no commit is a release type the derivation stays on the
lead commit, preserving the changelog category for non-release branches.
`deriveBody` deliberately stays on the HEAD commit — it is an explicitly-draft
one-line summary the ship flow may rewrite ([R-387](https://linear.app/rheged-studio/issue/R-387)).
