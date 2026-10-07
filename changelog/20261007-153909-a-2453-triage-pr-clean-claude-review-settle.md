---
title: settle a clean Claude review instead of waiting out the review cap
release_note: >-
  triage-pr now settles Claude as reported on a clean review, and
  rheged-skills-setup maps Claude to the estate claude-review check, so clean
  PRs no longer wait the full 20-minute review cap with Claude listed missing.
created_at: "2026-10-07T15:39:09Z"
merged_at:
branch: a-2453-triage-pr-clean-claude-review-settle
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-2453
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Added

- **Claude review check detection ([A-2453](https://linear.app/rheged-studio/issue/A-2453)).** `rheged-skills-setup` 0.14.0 sets
  triage-pr's `reviewBotChecks.claude` to
  `{ "name": "<job id>", "producer": "github-actions" }` when a
  `.github/workflows/*.yml` job calls the estate
  `reusable-claude-code-review.yml`, so Claude settles on the terminal
  `claude-review / claude-review` check on the head commit. Repos without the
  caller still get `{}`. An existing `{}` equals the `config.example.json`
  placeholder, so it is filled on reconcile; any other mapping is a deliberate
  edit and is kept.

## Fixed

- **Clean Claude reviews settle ([A-2453](https://linear.app/rheged-studio/issue/A-2453)).** triage-pr 0.17.2's
  `review-threads.mjs` only counted sticky-marker summaries, PR reviews and
  review threads for an unmapped bot. A clean Claude review leaves just the
  claude-code-action tracking comment, so Claude stayed `missing` and every
  clean PR waited out `reviewWaitMaxMinutes`. The activity fallback now also
  counts that comment once it opens with "**Claude finished @…'s task**", after
  the ready flip and on the current head (via `updatedAt`). The in-progress
  "Claude Code is working…" ack and an errored run still do not count.

## Changed

- This repo's dogfood triage-pr config maps `claude` to the `claude-review`
  check, and the config/example key-parity check now treats `reviewBotChecks`
  as a data map rather than structure.
