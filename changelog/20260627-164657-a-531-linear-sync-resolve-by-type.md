---
title: Resolve linear-sync workflow states by Linear type, not display name
release_note: The linear-sync skill now resolves the target workflow state by Linear's stable state type (started/completed/…) with the display name and position as tiebreakers, instead of matching literal names like "In Progress" / "In Review" / "Done". A consumer who renamed a state (e.g. "In Progress" → "Doing") now transitions correctly rather than silently failing to match. Skip/apply decisions use the type progression order, so terminal (completed/canceled) issues are never advanced.
created_at: '2026-06-27T16:46:57Z'
merged_at: '2026-06-27T17:24:31Z'
branch: a-531-linear-sync-resolve-workflow-states-by-linear-type-not
pr: 60
commit: 26f8fd7
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-531
stats:
  files_changed: 3
  loc_added: 82
  loc_removed: 15
  commits: 1
version: 1.2.0
---

## Changed

- **`linear-sync` resolves workflow states by type, not display name ([R-531](https://linear.app/rheged-studio/issue/R-531)).**
  The skill matched target and current states by literal display name
  (`In Progress` / `In Review` / `Done` / …), so a consumer who renamed a state
  (e.g. `In Progress` → `Doing`, `In Review` → `Code Review`) silently failed to
  match — the skill never found the target and either errored or no-opped. It now
  resolves each target from `list_issue_statuses` by Linear's stable `type`
  (`triage` / `backlog` / `unstarted` / `started` / `completed` / `canceled`), with
  the display name and `position` as tiebreakers for the shared `started` type (In
  Progress vs In Review). Apply/skip decisions use the type progression order, so a
  `completed` / `canceled` issue is never advanced, and the transition fires against
  the resolved state `id` rather than a literal name. Bundled as `linear-sync@0.3.0`.
