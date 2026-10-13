---
title: structured Questions UI for Phase B human envelope
release_note: triage-pr's Phase B human envelope now uses Cursor AskQuestion or Claude Code AskUserQuestion (Yes/No/Other, default yes), with an Option A disposition-detail summary and GitHub thread permalinks so you can approve without leaving chat.
created_at: "2026-09-01T15:40:28Z"
merged_at: "2026-09-01T17:04:30Z"
branch: a-1647-structured-questions-ui-phase-b
pr: 178
commit: bba638e
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - R-1647
stats:
  loc_added: 297
  loc_removed: 87
  files_changed: 7
  commits: 4
version: 1.7.0
---

## Added

- **`triage-pr` (0.14.0):** Phase B human envelope (and the slow-bot micro-gate)
  prefer a structured Questions UI — Cursor `AskQuestion` or Claude Code
  `AskUserQuestion` — with batch **Yes / No / Other** (**default yes**), an
  Option A disposition-grouped detail block (soft-capped declines), and thread
  permalinks from the review-threads fetcher. Prose `[Y/n]` remains the
  fallback when neither tool is available. The same contract applies on
  `/send-it` chains and Step 12 re-envelopes
  ([R-1647](https://linear.app/rheged-studio/issue/R-1647)).
