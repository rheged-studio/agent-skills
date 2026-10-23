---
title: bundle tested wait scripts in triage-pr and send-it
release_note: triage-pr and send-it now wait on CI and review bots with bundled, tested scripts instead of hand-written shell poll loops.
created_at: "2026-10-23T12:35:06Z"
merged_at: "2026-10-23T13:31:39Z"
branch: r-2925-bundle-tested-wait-scripts-in-triage-pr-and-send-it-instead
pr: 226
commit: f2d33cb
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - R-2925
stats:
  loc_added: 2621
  loc_removed: 111
  files_changed: 14
  commits: 5
version: 1.14.0
---

## Added

- **`triage-pr/scripts/wait-reviews.mjs` waits for review bots to settle ([R-2925](https://linear.app/rheged-studio/issue/R-2925)).** It polls `review-threads.mjs` every 60 seconds with the bundle's `reviewBots`, `reviewBotChecks`, `reviewIdleMinutes` and `reviewWaitMaxMinutes`. It applies the Step 7 settle rule (all, idle or max wait), writes the last fetcher JSON to a file and prints a one-line verdict. A fetch or parse failure is retried and then exits 1; it is never reported as settled. That was the failure on cadogan PR #34, where zsh's `echo` broke CodeRabbit's JSON and a hand-written loop printed `settled=all`.
- **`triage-pr/scripts/wait-checks.mjs` waits for the required checks.** It reads the base branch's required contexts from rulesets, falling back to legacy protection, and applies the Step 2 green test to the head commit. A missing context, an unfinished rerun, or a run cancelled in the last few minutes counts as pending. An empty rollup is never green. Its `--registered` mode is send-it's cold-start gate, with separate exit codes for a `gh` failure and for no checks.
- **Both scripts support Cursor's terminal timeout.** `--run-minutes` ends one invocation early, and `--resume` continues the same wait with its clocks intact.
- **Both scripts have unit tests.** They use a fake `gh` runner and an injected clock, so nothing waits in real time.

## Changed

- **triage-pr and send-it run the scripts instead of describing a poll loop.** This covers triage-pr's "Waiting on long operations" section, Steps 2, 6, 7 and 12, and send-it's Step 11.3 cold-start gate. The prose now tells the agent not to write its own loop.
- **send-it needs triage-pr 0.20.0 or later.** If the installed triage-pr has no `scripts/wait-checks.mjs`, send-it warns and stops at the open PR.
- **triage-pr minor-bumped to 0.20.0; send-it minor-bumped to 0.13.0.**
