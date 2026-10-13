---
title: Add the triage-pr skill
release_note: >-
  New triage-pr skill — drives a pull request from draft with failing CI to
  merge-ready: fixes in-scope CI failures, then validates and actions unresolved
  AI review feedback.
version: 1.1.0
created_at: '2026-06-01T19:22:53Z'
merged_at: '2026-06-23T19:42:58Z'
branch: asw-297-build-triage-pr-skill
pr: 10
commit: e183795
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-297
stats:
  files_changed: 7
  loc_added: 1031
  loc_removed: 0
  commits: 10
---

## Added

- `triage-pr` skill at `skills/triage-pr/` — a skills.sh bundle (`SKILL.md` + `package.json` named `@acme-skunkworks/skill-triage-pr`) conforming to ADR-0001's layout. Takes a PR from draft with failing CI to merge-ready in two phases: **Phase A** (while draft) fixes in-scope CI failures — never weakening CI config to greenwash — and loops until green; **Phase B** (after a human marks it ready) fetches unresolved AI review feedback, validates each finding against the codebase, actions the valid ones, and declines the rest with technical reasoning.
- A `gh`-backed review-thread fetcher (`scripts/review-threads.mjs`) that surfaces the sticky AI review summary separately from inline review threads — the main silent-miss risk — normalises `[bot]`-suffixed login matching, and ships a `--self-test` suite (18 cases). `parseArgs` fails fast on unknown flags, missing flag values, and malformed `--repo` identifiers.
- Configurable `reviewBots` and `maxCiRounds` knobs via `config.json`.
