---
title: triage-pr can optionally auto-promote a draft PR to ready on green CI
release_note: 'triage-pr gains an opt-in promoteOnGreen knob (plus --promote / --no-promote per-run overrides, default-off) that flips a draft PR to ready-for-review once Phase A finishes with every required check genuinely green — then continues into Phase B — instead of stopping at green for a human to flip. The flip is guarded: it fires only on proven-green CI (the watched rollup, never "no failures yet"), with no unresolved human review threads and no unresolved base drift (mergeStateStatus BEHIND / DIRTY); --ci-only and --dry-run never promote. With the knob unset and no flag, behaviour is identical to before.'
created_at: '2026-06-26T19:46:59Z'
merged_at:
branch: sk-455-triage-pr-optionally-auto-promote-a-draft-pr-to-ready-when
pr:
commit:
merge_strategy:
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-455
affected_packages:
  - triage-pr
stats:
  files_changed:
  loc_added:
  loc_removed:
version: 1.2.0
---

## Added

- **`promoteOnGreen` knob for `triage-pr`** (`config.json` / `config.example.json`,
  default `false`). When `true`, once Phase A finishes with every required check
  genuinely green on a **draft** PR, the skill runs `gh pr ready <pr>` to flip it to
  ready-for-review — the gate that turns AI review on — and then continues into
  Phase B, instead of stopping at green for a human to flip. This lets
  `send-it → triage-pr` run end-to-end (open → CI green → ready → AI review → action
  findings) without a babysitting `gh pr ready` step.
- **`--promote` / `--no-promote` per-run overrides.** `--promote` opts in for a single
  run regardless of the config default; `--no-promote` forces the default
  stop-at-green even when `promoteOnGreen` is `true`.

## Changed

- **The "never flip draft → ready" rule is now a guarded opt-in, not an absolute.**
  By default `triage-pr` still never promotes — it reads draft state only to choose a
  phase, and the human flips. The auto-flip fires **only** when promotion is enabled
  **and** all three gates hold: the green is _proven_ (Step 6's watched rollup, never
  "no failures yet" — no greenwashing), there are **no unresolved human review
  threads** (reusing the bundled `review-threads.mjs` `humanThreads` set), and
  `mergeStateStatus` shows no unresolved base drift (`BEHIND` / `DIRTY`). `--ci-only`
  and `--dry-run` never promote. With the knob unset and no flag, behaviour is
  byte-for-byte unchanged.
