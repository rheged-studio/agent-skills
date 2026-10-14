---
title: Dry-run/preview parity across the shared skills
release_note: Closes the dry-run/preview gaps the R-458 smoke pass surfaced so every shared skill has a consistent, truthful "preview, change nothing" path. linear-sync gains a read-only --dry-run that reports each issue's intended transition without writing; initialise-skills now infers triage-pr's promoteOnGreen/replyOnAccept defaults instead of flagging them needs-manual-input; preflight's --dry-run is now a true preview (every linter reports would-run and nothing — including .preflight-summary.json — is written); the changelog enrichment scripts (set-affected-packages, add-links) gain a --check/--dry-run no-write mode; and triage-pr's respond-threads gains --help plus documented --self-test.
created_at: '2026-06-26T20:44:58Z'
merged_at: '2026-06-26T21:14:19Z'
branch: sk-459-harden-skill-dry-runpreview-parity-ahead-of-estate-rollout
pr: 46
commit: a90179d
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-459
affected_packages:
  - changelog
  - infrastructure
  - initialise-skills
  - linear-sync
  - preflight
  - triage-pr
stats:
  files_changed: 21
  loc_added: 377
  loc_removed: 53
  commits: 12
version: 1.2.0
---

## Added

- **`linear-sync --dry-run`** — a read-only preview that resolves state IDs and each
  issue's current state, reports the intended transition (or skip reason) per issue,
  and exits without any `save_issue` write. Closes the one true gap from the [R-458](https://linear.app/rheged-studio/issue/R-458)
  pass (`linear-sync` previously had no safe preview).
- **`initialise-skills` now infers triage-pr's boolean knobs.** New constant-default
  detectors give `promoteOnGreen` (`false`) and `replyOnAccept` (`true`) a detected
  value, so a fresh reconcile reports them `inferred`/`unchanged` rather than
  `needs-manual-input` on every run. A deliberate edit still reads as `drift` and is
  kept. Adds the bundle's first unit test.
- **`--check` (alias `--dry-run`) on the changelog enrichment scripts**
  (`set-affected-packages.mjs`, `add-links.mjs`) — a no-write preview that reports
  what would change and exits `0` when already up to date, `1` when a rewrite is
  needed (prettier-`--check` style, so CI can gate on it).
- **`respond-threads --help`** prints full subcommand/flag usage, and `--self-test`
  is now documented in the triage-pr SKILL.md.

## Changed

- **`preflight --dry-run` is now a true preview.** The summary reports
  `eslint=would-run` (it previously mislabelled it `eslint=ran`) and the run writes
  nothing — including `.preflight-summary.json`, which is now written only on a real
  run. ESLint already returned early under `--dry-run`; this corrects the reporting
  and removes the stray file write.

Each changed bundle's `package.json` version and `SKILL.md metadata.version` are
bumped in lockstep: `linear-sync` `0.2.0`, initialise-skills `0.3.0`, changelog `0.3.0`
(minor); preflight `0.1.3`, triage-pr `0.3.1` (patch).
