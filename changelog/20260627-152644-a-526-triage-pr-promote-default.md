---
title: Default the triage-pr skill to promoting a green draft PR to ready-for-review
release_note: 'The triage-pr skill now promotes a draft PR to ready-for-review by default once Phase A CI is cleanly green, flipping the promoteOnGreen config default from false to true. The existing safety gates are unchanged — promotion is still suppressed unless the green is proven, there are no unresolved human review threads, and there is no unresolved base drift. Pass --no-promote (or set promoteOnGreen: false) to opt out and leave the flip to a human.'
created_at: '2026-06-27T15:26:44Z'
merged_at: '2026-06-27T15:42:28Z'
branch: a-526-triage-pr-promote-default
pr: 54
commit: 4f834db
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-526
stats:
  files_changed: 4
  loc_added: 45
  loc_removed: 11
  commits: 2
version: 1.2.0
---

## Changed

- **`triage-pr` promotes a green draft PR to ready-for-review by default ([R-526](https://linear.app/rheged-studio/issue/R-526)).**
  The `promoteOnGreen` knob in the skill's `config.json` now defaults to `true`, so
  a cleanly-green Phase A automatically runs `gh pr ready <pr>` — the gate that turns
  AI review on — and continues into Phase B, rather than stopping at green and
  leaving the flip to a human. The promotion gate is unchanged: the flip is still
  suppressed unless the green is _proven_ (the watched rollup, never "no failures
  yet"), there are **no unresolved human review threads**, and `mergeStateStatus`
  shows no unresolved base drift (`BEHIND` / `DIRTY`). Pass `--no-promote` (or set
  `promoteOnGreen: false`) to opt out; `--ci-only` and `--dry-run` never promote, as
  before. Bundled as `triage-pr@0.4.0`.
