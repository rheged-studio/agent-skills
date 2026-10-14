---
title: 'release-status: drop previewBump legacy title fallback'
release_note: ''
created_at: '2026-08-04T11:06:21Z'
merged_at: '2026-08-04T12:07:03Z'
branch: a-1180-release-status-drop-previewbump-legacy-title-fallback
pr: 151
commit: cd318a5
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - R-1180
stats:
  files_changed: 5
  loc_added: 31
  loc_removed: 10
  commits: 2
version: 1.4.0
---

## Changed

- **`release-status` (0.2.0 → 0.2.1):** drop the unused `commit.title` fallback in
  `previewBump`, remove the self-serving vitest case, and update the JSDoc so the
  helper only documents `{ subject, body }` — the only shape
  `parseGitLog` / `fetchCommitsSinceLastTag` ever emit
  ([R-1180](https://linear.app/rheged-studio/issue/R-1180)).
