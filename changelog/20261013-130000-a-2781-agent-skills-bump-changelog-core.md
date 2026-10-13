---
title: bump changelog-core to 1.2.0
release_note: ""
created_at: "2026-10-13T13:00:00Z"
merged_at: ""
branch: a-2781-agent-skills-bump-changelog-core
pr: ""
commit: ""
author: rob@rheged.studio
co_authors: []
category: chore
breaking: false
issues:
  - A-2781
  - A-2684
stats: {}
version: ""
---

## Changed

- **`@rheged-studio/changelog-core` 1.2.0 ([A-2781](https://linear.app/rheged-studio/issue/A-2781)).** The devDependency and lockfile move from `^1.1.1` to `^1.2.0`, so
  `validate:changelog`, the completeness gate and the post-merge finalise
  extract a branch's leading issue ID, as the skills do. Part of
  [A-2684](https://linear.app/rheged-studio/issue/A-2684).
