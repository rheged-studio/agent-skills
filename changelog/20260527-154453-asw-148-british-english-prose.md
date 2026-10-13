---
title: "Require British English in prose"
release_note: "Documents the British English spelling and grammar convention for repository prose."
version: "0.0.1"
created_at: "2026-05-27T15:44:53Z"
merged_at: "2026-05-27T16:18:37Z"
branch: "asw-148-claudemd-require-british-english-spelling-and-grammar"
pr: 5
commit: "27d21eb"
merge_strategy: merge
author: "rob@acmeskunkworks.io"
co_authors: []
category: docs
breaking: false
issues: ["R-148"]
stats:
  files_changed: 2
  loc_added: 14
  loc_removed: 0
  commits: 2
---

## Added

- A `## Writing style` section to `CLAUDE.md` requiring British English spelling and grammar across prose (comments, docs, commit messages, PR bodies, user-facing strings), explicitly carving out identifiers, dependency names, third-party API field names, and quoted upstream text — the rule applies to prose, not code.
