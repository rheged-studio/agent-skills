---
title: "Close post-merge review findings from the R-318 hardening"
release_note: "Tidies four bot-review findings left open after PR #12 — cache keys, the yamllint PATH guard, a bats comment, and single-sourcing the actionlint version."
version: "0.0.1"
created_at: "2026-06-01T12:59:06Z"
merged_at: "2026-06-01T13:20:16Z"
branch: "asw-349-double-check-pr-12-bot-review-comments-claude-coderabbit"
pr: 13
commit: "2b00563"
merge_strategy: squash
author: "rob@acmeskunkworks.io"
co_authors: []
category: chore
breaking: false
issues: ["R-349"]
stats:
  files_changed: 5
  loc_added: 38
  loc_removed: 15
  commits: 4
---

## Fixed

- Dropped the bats cache `restore-keys` prefix in `validate.yml`, matching the exact-key-or-cold policy already used for the yamllint and actionlint caches.
- Pre-exported `PATH` before the `command -v` guard in `ensure-yamllint.sh` (mirroring `ensure-bats.sh`), so a cache-restored binary is discoverable and a cache hit skips the redundant re-install.
- Corrected an inaccurate comment in `publish-via-raw-npm.bats` and renamed `view_output` → `view_stderr` to match the sibling suite.
- Single-sourced the actionlint version via a job-level `ACTIONLINT_VERSION` env, removing the dual-maintenance footgun.
