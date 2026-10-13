---
title: Impact-gate triage-pr's fix-now vs defer decision
release_note: triage-pr Phase B now fixes valid in-scope review findings only when they are high-impact; everything else reuses the existing human-approved Linear defer path. A new deferNonBlocking config knob (default on) controls the gate.
created_at: '2026-07-31T16:01:19Z'
merged_at: '2026-08-03T10:24:31Z'
branch: a-1024-feattriage-pr-impact-gate-the-fix-now-vs-defer-decision
pr: 143
commit: 286d0b7
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-1024
stats:
  files_changed: 16
  loc_added: 144
  loc_removed: 39
  commits: 6
version: 1.4.0
---

## Added

- **Impact gate on Phase B fix-now ([R-1024](https://linear.app/rheged-studio/issue/R-1024)).**
  When `deferNonBlocking` is on (the default), a valid in-scope finding is fixed
  inline only if it is high-impact — it blocks later work, touches agent-skill /
  Claude Code / CI or release infrastructure, or is critical/high severity
  (correctness, security, data-loss). Classification is model-owned; bot severity
  labels are not trusted. Otherwise the finding is deferred and captured via the
  existing Step 10 human-approved Linear path. Set `deferNonBlocking: false` to
  restore scope-only behaviour.

- **`deferNonBlocking` config key** in `config.example.json` and dogfood config,
  with `initialise-skills` emitting the default so consumers are not flagged
  `needs-manual-input`.

## Changed

- Defer reply copy is neutral (`Deferred for this PR…`) so it covers both
  out-of-scope and in-scope-but-not-high-impact findings; the summary display
  label for `out-of-scope` status is now `Deferred`.
- Bundle versions: `triage-pr` 0.8.1, `initialise-skills` 0.10.8.

## Fixed

- Softened the `defer-pending` reply so it no longer promises a follow-up issue
  will be filed when capture is disabled or the human declines approval.
