---
title: Only alert the human once triage-pr CI is terminal
release_note: triage-pr no longer claims a run is complete while required checks are still queued, pending, or in progress — the human is only alerted at the final report once every required check is terminal.
created_at: '2026-08-03T16:26:45Z'
merged_at: '2026-08-03T16:58:05Z'
branch: a-1178-fixtriage-pr-only-alert-the-human-once-ci-has-fully
pr: 145
commit: '9799940'
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-1178
stats:
  files_changed: 6
  loc_added: 81
  loc_removed: 8
  commits: 4
version: 1.4.0
---

## Fixed

- **Step 6 / Step 12 alert carve-out.** Clarified that documented Phase-A early stops (promotion disabled / gate failed / `--ci-only` / `--dry-run`) are valid completion alerts, not interim mid-watch pings — Step 12 remains the alert for a full run.

- **Completion contract ([R-1178](https://linear.app/rheged-studio/issue/R-1178)).**
  Agents must not claim the triage run is complete, green, or ready for attention
  while any required check is still queued, pending, or in progress. Step 6 stays
  quiet during the watch; Step 12 is the only completion alert and must cite the
  proving command's fresh terminal states. Bundle bumped to `0.8.3` (via `0.8.2`).
