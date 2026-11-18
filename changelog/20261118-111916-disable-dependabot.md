---
title: remove Dependabot configuration
release_note: ""
version:
created_at: "2026-11-18T11:19:16Z"
merged_at: "2026-11-18T11:51:39Z"
branch: disable-dependabot
pr: 231
commit: d278ade
author: rob@rheged.studio
co_authors: []
category: chore
breaking: false
issues: []
stats:
  files_changed: 2
  loc_added: 24
  loc_removed: 40
---

## Changed

- **Dependabot is switched off.** `.github/dependabot.yml` is deleted, as part of switching
  Dependabot off across the estate. Dependency updates no longer open automatic PRs.
