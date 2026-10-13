---
title: stop agents treating draft PR as end of /send-it
release_note: Skim-level send-it and triage-pr copy no longer reads as complete once a draft PR is open. Done criteria, a Step 11 completion gate, and clearer prerequisites make the triage chain part of a default /send-it run; stopping at an open draft without an explicit skip reason is a failed run.
created_at: "2026-09-01T11:39:21Z"
merged_at: "2026-09-01T12:12:52Z"
branch: a-1645-fix-send-it-stop-agents-treating-draft-pr-as-end
pr: 176
commit: 14c0f2c
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - R-1645
stats:
  loc_added: 127
  loc_removed: 59
  files_changed: 10
  commits: 6
version: 1.6.1
---

## Fixed

- **`send-it` (0.8.2):** skim surfaces that still ended at "open a draft PR" /
  "In Review" — package.json description, CLAUDE.md invocation comments,
  "finisher" framing, and `` `triage` _(optional)_ `` / "`triage-pr` — optional"
  wording that read as the _step_ being optional. A default run now states
  **done criteria** up front and a **completion gate** at Step 11: reporting a
  draft PR URL as the final outcome without `ℹ️ triage chain skipped …` and a
  reason is a failed run ([R-1645](https://linear.app/rheged-studio/issue/R-1645)).

- **`triage-pr` (0.13.1):** replace "complements `/send-it` (which **opens** the
  draft PR)" with language that `/send-it` opens or updates the PR and then
  **invokes this skill as Step 11**. Standalone `/triage-pr` remains for
  mid-flight re-entry, not the normal end of send-it.
