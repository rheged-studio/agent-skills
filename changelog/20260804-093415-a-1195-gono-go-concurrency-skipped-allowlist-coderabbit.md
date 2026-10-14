---
title: Stop GO/NO GO false-reds and CodeRabbit PR-description edits
release_note: ''
created_at: '2026-08-04T09:34:15Z'
merged_at: '2026-08-04T10:03:26Z'
branch: a-1195-gono-go-concurrency-skipped-allowlist-coderabbit
pr: 150
commit: '9730145'
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - R-1195
stats:
  files_changed: 4
  loc_added: 57
  loc_removed: 3
  commits: 2
version: 1.4.0
---

## Changed

**GO/NO GO concurrency + skipped allowlist + CodeRabbit walkthrough ([R-1195](https://linear.app/rheged-studio/issue/R-1195))** — set `cancel-in-progress: false` on `validate.yml` and `validate-pr-title.yml` so a superseded run cannot mint a false-red gate; replace the blanket `skipped` accept with the branch-conditional allowlist (release-please only); put CodeRabbit's high-level summary in the walkthrough comment so description edits stop re-firing CI.
