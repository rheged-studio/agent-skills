---
title: propagate the lint-surface gate to preflight and commit
release_note: preflight now reports a branch's lint-config edits and added ignore directives as developer decisions, and commit and send-it surface them too, under one shared lint-surface rule.
created_at: "2026-10-12T21:41:17Z"
merged_at:
branch: a-1203-lint-surface-gate-in-preflight-and-commit
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-1203
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
version:
---

## Added

- **Shared lint-surface rule ([A-1203](https://linear.app/rheged-studio/issue/A-1203)).** The rule that lint-config edits and
  ignore / disable directives are a developer decision is now written once, in
  `lib/lint-surfaces.md`. It is vendored into the `triage-pr`, `preflight` and
  `commit` bundles as `references/lint-surfaces.md`, and each skill says where
  its own natural stopping point is.
- **preflight `lintSurface` ([A-1203](https://linear.app/rheged-studio/issue/A-1203)).** `.preflight-summary.json` gains a
  `lintSurface` report: the lint config files the branch changes and each
  ignore / disable directive it adds (file, line and directive). Directives are
  matched by file type, so prose that only mentions one isn't flagged. The
  report is informational and never changes the exit code. The skill's
  `lint-fix` loop must fix the code, never a lint surface. preflight moves to
  0.5.0.
- **commit staging plan ([A-1203](https://linear.app/rheged-studio/issue/A-1203)).** The plan lists lint-surface changes as
  developer decisions to confirm, and the skill never authors one itself.
  commit moves to 0.3.0.
- **send-it Step 5 ([A-1203](https://linear.app/rheged-studio/issue/A-1203)).** Any `lintSurface` entries are carried into the
  PR body's Evidence and the final report. send-it moves to 0.12.0.

## Changed

- **vendor-sync and ADR-0006.** `vendor-sync.mjs` now vendors markdown as well
  as `.mjs`, with an HTML-comment banner and a `references/` destination.
  ADR-0006 records this as an extension of ADR-0004.
- **triage-pr.** `review-discipline.md` points at the vendored rule and keeps
  only triage-pr's own stopping points. triage-pr moves to 0.18.1.
