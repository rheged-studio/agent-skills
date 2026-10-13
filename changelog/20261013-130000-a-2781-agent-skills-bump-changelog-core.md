---
title: bump changelog-core to 1.2.0
release_note: ""
created_at: "2026-10-13T13:00:00Z"
merged_at: "2026-10-13T13:30:38Z"
branch: a-2781-agent-skills-bump-changelog-core
pr: 209
commit: e14ca3e
author: rob@rheged.studio
co_authors: []
category: chore
breaking: false
issues:
  - R-2781
  - R-2684
stats:
  loc_added: 31
  loc_removed: 6
  files_changed: 3
version: ""
---

## Changed

- **`@rheged-studio/changelog-core` 1.2.0 ([R-2781](https://linear.app/rheged-studio/issue/R-2781)).** The devDependency and lockfile move from `^1.1.1` to `^1.2.0`, so
  `validate:changelog`, the completeness gate and the post-merge finalise
  extract a branch's leading issue ID, as the skills do. Part of
  [R-2684](https://linear.app/rheged-studio/issue/R-2684).
