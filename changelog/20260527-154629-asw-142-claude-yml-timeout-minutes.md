---
title: "Set a 30-minute timeout on the Claude job"
release_note: "Caps the @claude responder job at 30 minutes, matching the Code Review workflow."
version: "0.0.1"
created_at: "2026-05-27T15:46:29Z"
merged_at: "2026-05-27T16:18:20Z"
branch: "asw-142-add-timeout-minutes-to-githubworkflowsclaudeyml"
pr: 6
commit: "59c4db4"
merge_strategy: merge
author: "rob@acmeskunkworks.io"
co_authors: []
category: chore
breaking: false
issues: ["R-142"]
stats:
  files_changed: 2
  loc_added: 5
  loc_removed: 0
  commits: 2
---

## Changed

- Added `timeout-minutes: 30` to the `claude` job in `.github/workflows/claude.yml`, matching the sibling `claude-code-review.yml`. Without it a stuck `@claude` job would fall back to GitHub Actions' default 6-hour timeout and quietly burn Actions minutes.
