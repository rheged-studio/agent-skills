---
title: verify producer of mapped review-bot check
release_note: triage-pr reviewBotChecks can pin the status creator or check-suite app slug so a same-named check from another producer cannot end Phase B early.
created_at: "2026-10-06T20:18:00Z"
branch: a-2328-triage-pr-verify-the-producer-of-a-mapped-review-bot-check
category: feature
breaking: false
issues:
  - A-2328
merged_at: "2026-10-06T19:35:11Z"
commit: c922758
pr: 191
stats:
  loc_added: 286
  loc_removed: 27
  files_changed: 4
  commits: 5
version: 1.10.0
---

## Added

- **triage-pr 0.17.1 ([A-2328](https://linear.app/rheged-studio/issue/A-2328)).**
  `reviewBotChecks` values may be a string check name (unchanged) or
  `{ "name": "…", "producer": "…" }`. When `producer` is set, settle matches
  `StatusContext.creator.login` or `CheckRun.checkSuite.app.slug` as well as the
  check name. GraphQL rollup fetch selects those fields; offline self-tests cover
  spoofed and matching producers.
