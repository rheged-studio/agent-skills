---
title: Fix preflight silently skipping top-level code in the lint gate
release_note: The preflight skill no longer passes silently when a changed code file lives at the repo root (or any path) outside scripts/, a detected workspace, and the root ESLint config. Such files previously set codeChanged but matched no ESLint bucket, so preflight reported that ESLint ran while linting nothing — a false-pass in the 0/1/2 exit contract that send-it relies on. They are now routed to the root ESLint bucket and linted at the repo root.
created_at: '2026-06-27T16:32:43Z'
merged_at: '2026-06-27T17:24:26Z'
branch: a-527-preflight-top-level-code-is-silently-never-linted-false-pass
pr: 56
commit: c69829f
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-527
stats:
  files_changed: 5
  loc_added: 68
  loc_removed: 2
  commits: 1
version: 1.2.0
---

## Fixed

- **`preflight` no longer silently skips top-level lintable code ([R-527](https://linear.app/rheged-studio/issue/R-527)).**
  In `classifyChangedFiles`, a changed code file outside `scripts/`, outside every
  detected workspace, and not the root ESLint config set `codeChanged = true` but
  fell through into no ESLint bucket. Preflight then logged that it ran scoped
  ESLint, skipped every empty group, and **passed** — a silent false-pass that let
  introduced lint errors through the gate for any non-pnpm consumer, or any repo
  with linted code at the root outside `scripts/`. Such unclaimed lintable files
  are now routed to the **root** bucket and linted at the repo root with the root
  ESLint config (and auto-fixed by `lint-fix` alongside the other root files). Adds
  a regression test asserting top-level code is bucketed. Bundled as
  `preflight@0.1.6`.
