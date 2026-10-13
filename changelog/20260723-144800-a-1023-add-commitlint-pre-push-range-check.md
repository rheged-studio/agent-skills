---
title: Add commitlint pre-push range check
release_note:
version: 1.3.0
created_at: '2026-07-23T14:48:00Z'
merged_at: '2026-07-23T15:05:43Z'
branch: a-1023-tier-2-fan-out-commitlint-pre-push
pr: 137
commit: 85917be
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - R-1023
stats:
  files_changed: 6
  loc_added: 457
  loc_removed: 2
  commits: 3
---

## Added

- Best-effort `commitlint --from origin/main --to HEAD` check in `.husky/pre-push`
  ([R-1023](https://linear.app/rheged-studio/issue/R-1023)), alongside existing pre-push
  checks. Skips with an installation hint when `@commitlint/cli` is missing or when
  `origin/main` is not a resolvable ref; bypassable with `git push --no-verify`.
  Complements CI's `reusable-validate-commits` gate rather than replacing it.
- `commitlint.config.mjs` extending `@acme-skunkworks/commitlint-config`.
- `@commitlint/cli` and `@acme-skunkworks/commitlint-config` as devDependencies for the
  local range check.

## Changed

- Documented the pre-push commitlint range check in `CLAUDE.md`.
