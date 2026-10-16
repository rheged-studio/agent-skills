---
title: request only status and team fields from Linear in linear-sync
release_note: linear-sync now asks Linear only for each issue's team and state, so it never receives issue titles, descriptions or comments.
created_at: "2026-10-16T17:06:03Z"
merged_at:
branch: r-2874-linear-sync-request-only-statusteam-fields-from-linear-to
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - R-2874
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Fixed

- **`linear-sync` now uses field selection on every `get_issue` call ([R-2874](https://linear.app/rheged-studio/issue/R-2874)).** It passes `fields: ["id", "status", "statusType", "team"]`, so Linear never returns the issue title, description, comments, attachments or documents. This clears the Snyk W011 warning about third-party content exposure. SKILL.md shows the exact call and states that the report names issues by ID only.
- **`linear-sync` gains an "Untrusted input" section.** It names the remaining ingestion points (the branch name, matched with an escaped, anchored regex, and the admin-controlled team and state names) and tells the agent to treat them as data, never instructions.

## Changed

- **`linear-sync` patch-bumped to 0.4.3.**
