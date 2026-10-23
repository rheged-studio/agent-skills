---
title: wait for newer workflow runs before calling CI green
release_note: triage-pr's wait-checks.mjs no longer reports CI green while a newer run of the same workflow is still running on the head commit.
created_at: "2026-10-23T13:41:43Z"
merged_at:
branch: r-2925-wait-checks-wait-for-newer-workflow-runs
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - R-2925
stats:
  loc_added:
  loc_removed:
  files_changed:
version:
---

## Fixed

- **`wait-checks.mjs` waits for a newer run of the same workflow before calling CI green ([R-2925](https://linear.app/rheged-studio/issue/R-2925)).** Editing a PR body or flipping it to ready (`edited` / `ready_for_review`) re-runs a workflow on the same commit. Until the newer run created its gated job (`GO/NO GO`), the script judged that check by the older run's result. It reported `ci=green` while GitHub's merge gate was still BLOCKED; this was seen on PR #220. Each poll now also lists the Actions runs on the head commit. A check from an older run stays pending while a newer run of its workflow is queued or in progress. A repo without Actions (404) has no runs, and any other lookup failure is retried and then exits 1.

## Changed

- **triage-pr patch-bumped to 0.20.1.**
