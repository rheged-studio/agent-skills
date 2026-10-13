---
title: send-it chains into triage-pr once the PR is open
release_note: 'send-it no longer stops at the open PR. A new Step 11 hands the freshly-opened PR to the triage-pr skill and runs the full chain — Phase A''s CI fix loop and promote-on-proven-green flip, then Phase B''s review wait and verify-then-propose pass — halting at triage-pr''s human envelope. A default run therefore stays unattended for roughly 30 minutes and ends on a prompt rather than a report; --skip-triage, or the new triage config key set to false, restores the old bounded-finisher shape. Before handing off, send-it polls for at least one registered check so an empty statusCheckRollup can never be read as green and promote a draft before CI ran. --merge-when-ready is removed: with the chain in play an armed auto-merge could land a branch while its disposition plan awaited approval, so send-it never arms auto-merge and merging stays a human action.'
created_at: '2026-08-04T16:30:00Z'
merged_at: '2026-08-04T16:49:38Z'
branch: a-1151-send-it-chain-triage-pr
pr: 154
commit: 6e02156
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-1151
stats:
  files_changed: 16
  loc_added: 386
  loc_removed: 49
  commits: 9
version: 1.4.0
---

## Added

- **`send-it` Step 11 — chain into `triage-pr` ([R-1151](https://linear.app/rheged-studio/issue/R-1151)).**
  After the Linear writeback, send-it hands the PR it just opened to the
  [`triage-pr`](https://github.com/acme-skunkworks/agent-skills/blob/main/skills/triage-pr/SKILL.md)
  skill and runs the full chain: Phase A fixes in-scope CI failures and promotes the
  proven-green draft to ready, then Phase B waits for the AI reviewers, verifies every
  finding, and halts at triage-pr's human envelope. Thin delegation in the same prose
  form as `commit` / `preflight` / `changelog` / `linear-sync` — triage-pr's Phase A/B
  logic is not inlined, and `/triage-pr` stays fully usable on its own for mid-flight
  re-runs.

- **A cold-start gate before the hand-off.** Step 9 opens the PR moments earlier, so
  GitHub Actions may not have registered a single check yet. An empty
  `statusCheckRollup` handed to a cold triage-pr reads as "nothing failing" and, with
  `promoteOnGreen` default-on, would have flipped the draft to ready _before CI ran_.
  Step 11 now polls `statusCheckRollup` (10 seconds × 18) until at least one check
  exists, and degrades to `--no-promote` — saying why — if none ever appears.
  triage-pr's own "no failures yet is not green" rule guards its watch loop, not a
  cold entry, so this belongs on the calling side.

- **`triage` config key and `--skip-triage`.** The chain is on by default and is
  **part of the run, not an optional extra**: `--skip-triage` / `triage: false` is for
  the narrow cases where it cannot work — a PR that changes the chain itself,
  `triage-pr` absent, or CI gated on `draft == false` — not a way to finish sooner,
  and a run that skips it must say why. `--ci-only`, `--no-promote`, `--auto-apply`
  and `--dry-run` are forwarded to triage-pr verbatim and have no effect on send-it's
  own steps. A missing `triage-pr` **warns and finishes normally** — deliberately
  louder than Step 10's silent `linear-sync` skip, because a skipped Linear writeback
  changes nothing about the PR whereas a skipped triage chain leaves work undone.

## Removed

- **`send-it --merge-when-ready`.** It armed `gh pr merge --auto --merge` at Step 9,
  before triage would run. With the chain in play, that could land a branch while a
  Phase B disposition plan was still awaiting its `[y/N]`. Rather than reorder the
  arming, send-it no longer arms auto-merge at all: it takes a PR to green, ready and
  reviewed, and landing it stays a human action. Arm auto-merge yourself once you are
  happy with the PR. [ADR-0005](https://github.com/acme-skunkworks/agent-skills/blob/main/architecture/0005-dual-merge-policy.md)
  gains an "Amended by" header line; its merge-commit decision is unchanged.

## Changed

- **`--dry-run` now chains into `triage-pr --dry-run`** when a PR already exists for
  the branch, so the preview covers failing checks and unresolved findings too. It
  therefore makes **read-only** `gh` calls — it still writes, commits and pushes
  nothing. With no PR yet, it prints `no PR to triage yet` and exits 0.

- **What send-it _is_.** Through 0.7.0 it was a bounded finisher: seconds of work
  ending in a report and an open PR. The default run now continues into triage, stays
  unattended for roughly 30 minutes (`maxCiRounds` fix loop plus a 20-minute bot
  wait), and ends on a **prompt**. That shift is deliberate and recorded in the
  skill's Notes.

- **send-it's `allowed-tools` widens** to `Bash(npx:*)` and
  `mcp__linear-server__list_projects` — what the chained triage-pr run needs. Without
  them a 30-minute pipeline would stop for a permission prompt halfway through. Worth
  knowing: "ship my branch" can now invoke `npx`.

- **`initialise-skills` detects the new key.** `triage` emits a fixed `true`,
  alongside the other default-on booleans, so consumers do not see it flagged
  `needs-manual-input`. Deliberately _not_ inferred from whether `triage-pr` is
  vendored — Step 11's soft-skip already covers absence, so presence-inference could
  only misfire the way it once did for `changelog` ([R-570](https://linear.app/rheged-studio/issue/R-570)).

- Bundles: `send-it` `0.7.0` → `0.8.0`, `triage-pr` `0.10.1` → `0.10.2`,
  `initialise-skills` `0.10.9` → `0.10.10`.

## Notes

- **Consumers whose CI is gated on `draft == false`** register no checks on a draft,
  so the cold-start gate waits out its full window each run before degrading to
  `--no-promote`. Use `--ready`, or set `triage: false`, in those repos. Documented in
  the skill's Notes and the README config table.
- **Estate fan-out.** This adds a `send-it` config key, so consumers need a re-vendor.
  Batch it into the existing `humanEnvelope` sweep
  ([R-1183](https://linear.app/rheged-studio/issue/R-1183) …
  [R-1190](https://linear.app/rheged-studio/issue/R-1190)) rather than triggering a
  separate rollout.
