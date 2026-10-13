---
title: Add the parameterised single-repo fleet-update pipeline
release_note: 'A new infrastructure/scripts/fleet-update.mjs rolls one already-onboarded consumer repo onto the current shared skill bundles, driven by an install profile rather than interactive edits. It runs install → restore → reconcile → verify (no wipe): vendors the bundles via skills add --copy, restores every config.json the --copy re-vendor clobbers from the consumer''s trunk so no-detector keys survive, reconciles with initialise-skills, and verifies with check-updates that the repo is now current (the idempotency gate). It holds no repo list — one repo''s profile comes in as input — so it can run inside the private release-orchestrator fan-out without leaking the estate.'
created_at: '2026-07-06T18:00:00Z'
merged_at: '2026-07-06T17:00:13Z'
branch: a-617-ws3-agent-skills-fleet-update-script-fleet-updatemjs
pr: 107
commit: 05ad186
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: feature
breaking: false
issues:
  - R-617
stats:
  files_changed: 4
  loc_added: 1164
  loc_removed: 11
  commits: 4
version: 1.2.0
---

## Added

The final workstream (WS3) of the cross-repo skill-update efficiency effort. WS1
([R-615](https://linear.app/rheged-studio/issue/R-615)) made each `config.json`
locally-generated; WS2 ([R-616](https://linear.app/rheged-studio/issue/R-616))
added `.claude/skills.lock` + `check-updates.mjs`. This adds the single-repo
**update** pipeline the private release-orchestrator's fan-out
([R-713](https://linear.app/rheged-studio/issue/R-713)) calls once per consumer.

**`infrastructure/scripts/fleet-update.mjs` — install → restore → reconcile →
verify (no wipe).** Parameterised by one repo's install profile (a JSON contract
supplied on `--profile <file>` or stdin), it:

1. vendors the shared bundles with `skills add <source> … --copy`, pinned to the
   agent-skills checkout it runs inside;
2. **restores every `config.json` the `--copy` re-vendor clobbers** from the
   consumer's trunk (`git checkout HEAD -- …`), baking in the
   [R-706](https://linear.app/rheged-studio/issue/R-706) workaround so
   operator-set no-detector keys (`promoteOnGreen`, `linearTeamName`, …) survive.
   The current skills.sh CLI **overwrites** the tracked config rather than
   deleting it, so the detection catches both a delete and a modification
   (`--diff-filter=DM`);
3. reconciles each vendored mirror with `initialise-skills --write` (passing
   `--skills-dir` explicitly, since the pipeline runs the source checkout's
   `initialise.mjs`); and
4. verifies with `check-updates` that the repo is now current
   (`updatesAvailable === false`) — the idempotency gate. A re-run is a clean
   no-op.

It is **preview by default** (matching `fleet-wipe.mjs` / `vendor-sync.mjs`);
`--apply` mutates. `--self-test` runs the pure core offline, and a Vitest
companion (`infrastructure/tests/fleet-update.test.ts`) wires that core into CI.

**Install-profile schema** — the documented input contract (`repo`, `skills`,
`agents`, `repoType`, `facts`) is set out in
[`docs/fleet-deployment.md`](../docs/fleet-deployment.md), so the orchestrator's
unified manifest ([R-715](https://linear.app/rheged-studio/issue/R-715)) can
populate one profile per repo. The script **holds no repo list** — private repo
names never surface in this public repo's CI.
