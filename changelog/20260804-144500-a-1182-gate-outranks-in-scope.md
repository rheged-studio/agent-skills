---
title: triage-pr lint-surface gate outranks the in-scope bucket
release_note: Step 3's In-scope bullet now states that the lint-surface gate takes precedence, so a lint failure whose only remedy is a config change or ignore directive cannot be classified in-scope and fixed before reaching the gate.
created_at: '2026-08-04T14:45:00Z'
merged_at: '2026-08-04T14:05:03Z'
branch: a-1182-gate-outranks-in-scope
pr: 153
commit: 66729f0
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-1182
stats:
  files_changed: 3
  loc_added: 43
  loc_removed: 3
  commits: 4
version: 1.4.0
---

## Fixed

- **Bucket precedence in Step 3 ([R-1182](https://linear.app/rheged-studio/issue/R-1182)).**
  The **In-scope** bullet told the agent to fix any lint failure reproducible on
  the branch head, and it is listed _before_ **Lint-surface gated**. A reader
  matching the buckets top-down could classify a lint-only-surface failure as
  in-scope and fix it before reaching the gate. The In-scope bullet now names the
  precedence explicitly: **Lint-surface gated** takes precedence, regardless of how
  clearly the failure belongs to the PR.

  Raised by Cursor Bugbot on [#152](https://github.com/acme-skunkworks/agent-skills/pull/152)
  and approved there, but landed after that PR merged — hence this follow-up.

## Changed

- triage-pr bundle `0.10.0` → `0.10.1`.
