---
title: Fix undefined `dir` reference in the R-582 gitignore tests
release_note:
version: 1.2.0
created_at: '2026-06-30T13:00:36Z'
merged_at: '2026-06-30T13:02:31Z'
branch: a-602-a-582-gitignore-test-references-undefined-dir-breaks-pnpm
pr: 79
commit: 8ef14d9
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - R-602
stats:
  files_changed: 2
  loc_added: 36
  loc_removed: 3
  commits: 2
---

## Fixed

- **The [R-582](https://linear.app/rheged-studio/issue/R-582) gitignore tests reference an undefined `dir`
  ([R-602](https://linear.app/rheged-studio/issue/R-602)).** The two `!`-unignore cases
  added to `tests/skills/initialise-skills/gitignore.test.ts` called
  `reconcilePreflightIgnore(dir, …)`, but the `describe` block defines the temp root as
  `directory` — so both threw `ReferenceError: dir is not defined` and `pnpm test` failed.
  The three references now use `directory`, matching the sibling cases. Pure test fix — no
  production code, no bundle version bump. It merged on a stale-green Build & Lint check
  (that gate runs on PRs, not on pushes to `main`), so nothing re-ran the suite against the
  trunk.
