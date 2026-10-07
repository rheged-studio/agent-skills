---
title: wire the changelog-enrich bot identity from repo-config
release_note:
created_at: "2026-10-07T09:05:16Z"
merged_at: "2026-10-07T10:35:05Z"
branch: a-1953-wire-parameterised-changelog-enrich-agent-skills
pr: 196
commit: 335452c
author: rob@rheged.studio
co_authors: []
category: chore
breaking: false
issues:
  - A-1953
  - A-2344
  - A-1945
stats:
  files_changed: 4
  loc_added: 55
  loc_removed: 5
  commits: 5
version: 1.12.0
---

## Changed

- **Release CI ([A-1953](https://linear.app/rheged-studio/issue/A-1953)).** `infrastructure/repo-config.yaml` now declares the
  changelog write-back identity (`githubAppClientId`, `botName`, `botEmail`).
  The `changelog-enrich` job in `pkg-release.yml` takes these values from the
  `config` job's outputs, instead of relying on road-runner defaults inside
  shared-workflows. The values are road-runner's existing ones, so the
  write-back behaves exactly as before. The stale "pin at [A-821](https://linear.app/rheged-studio/issue/A-821) SHA" comment
  is gone.
- This depends on shared-workflows v1.8.1 ([A-2344](https://linear.app/rheged-studio/issue/A-2344)). Before that release, the
  config loader returns empty values for these keys, and an empty `bot-name`
  would break the write-back.
- `CLAUDE.md` now says the bot identity is changed in `repo-config.yaml`, not
  in the workflow.
