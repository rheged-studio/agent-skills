---
title: Resolve wave-3 bundle review findings and reconcile changelog pr ownership
release_note: Fixes preflight early-exit config reporting, changelog stats-block synthesis, and gitignore un-ignore reporting, and reconciles the changelog `pr` field's ownership to the release/enrich step.
created_at: '2026-07-03T18:58:04Z'
merged_at: '2026-07-03T19:44:35Z'
branch: a-613-wave-3-bundle-review-findings
pr: 92
commit: d182ced
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-613
  - R-676
stats:
  files_changed: 25
  loc_added: 290
  loc_removed: 77
  commits: 6
version: 1.2.0
---

## Fixed

**preflight:** the two early-exit paths (empty diff / no lintable changes) now
thread the resolved `blockOnWarnings` into `buildSummary`, so
`.preflight-summary.json` reports the configured value rather than the default
`false` when preflight short-circuits ([R-613](https://linear.app/rheged-studio/issue/R-613)).

**changelog:** `backfill-commits` now synthesises a minimal `stats:` block for an
entry that omits `stats` entirely — the contract permits this — instead of
throwing `no stats block to extend`. `commit-count`'s missing-`parents` fallback
is documented and pinned by a test (a commit without parent data counts as
authored work, never a merge). The `add-links` / `backfill-commits` /
`finalise-changelog` CLI-entry guards now use the two-sided `realpathSync`
comparison used elsewhere, so a symlinked entrypoint (macOS `/var`→`/private/var`,
the pnpm store) no longer skips `main()` ([R-613](https://linear.app/rheged-studio/issue/R-613)).

**initialise-skills:** a deliberately un-ignored `.preflight-summary.json`
(`!.preflight-summary.json`) is now reported as a distinct `negated` status,
honouring `.gitignore`'s last-match-wins rule, instead of being mislabelled
"already ignored" ([R-613](https://linear.app/rheged-studio/issue/R-613)).

## Changed

**changelog / send-it:** the `pr` frontmatter field is now documented consistently
as owned by the release/enrich step — resolved post-merge from the entry's
`branch:`, never written by the ship flow. Reconciles the changelog skill, the
changelog contract's field-ownership table, and send-it's Step 7 ([R-676](https://linear.app/rheged-studio/issue/R-676)).

**triage-pr:** the Linear-resolution rule is kept inside the bundle rather than
pointing at a sibling skill's file, the `skills-ref` validation command is pinned
to `@0.1.5` to match CI, and the README synopsis is refreshed for the
`promoteOnGreen` default ([R-613](https://linear.app/rheged-studio/issue/R-613)).
