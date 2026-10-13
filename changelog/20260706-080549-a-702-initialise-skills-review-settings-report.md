---
title: 'initialise-skills: read-only --review settings report'
release_note: initialise-skills gains a read-only --review mode that prints, for every installed skill, its full current config — each key's current value, its source classification (inferred / unchanged / drift / manual-kept / needs-manual-input / unknown-kept), and a short description drawn from references/detectable-keys.md. Unlike the dry-run diff it shows every key, including ones no template knows about (unknown-kept) and template keys not yet set, so it is a complete picture of the config rather than just the pending reconcile. It writes nothing and offers a --json form alongside the human text.
created_at: '2026-07-06T08:05:49Z'
merged_at: '2026-07-06T08:34:00Z'
branch: a-702-featinitialise-skills-read-only-review-settings-report
pr: 100
commit: c0b44d3
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: feature
breaking: false
issues:
  - R-702
stats:
  files_changed: 10
  loc_added: 539
  loc_removed: 11
  commits: 5
version: 1.2.0
---

## Added

**initialise-skills:** a new read-only `--review` mode. `initialise-skills`
reconciles detected facts into each skill's `config.json`, but until now the only
way to inspect a config was the dry-run diff — which covers only detectable keys
and never shows a key's current value or explains what it means.

`--review` prints, for every installed skill, its **full current config**: each
key's current value, its source classification (`inferred` / `unchanged` /
`drift` / `manual-kept` / `needs-manual-input` / `unknown-kept`), and a one-line
description of what the key is and where its value comes from, sourced from
[`references/detectable-keys.md`](../skills/initialise-skills/references/detectable-keys.md).
Unlike the dry-run it shows the value of **every** key — including keys a
consumer set that no template knows about (`unknown-kept`, kept verbatim) and
template keys not yet present in `config.json` (rendered `— not set`) — so the
review is a complete picture of the config rather than just the pending diff. It
is strictly read-only: it writes nothing and skips the `.gitignore` step. A
`--json` form ships alongside the human-readable text.

Implemented as a new `scripts/lib/references.mjs` (parses the detectable-keys
table) plus `buildReviewReport` / `formatReview` in `scripts/lib/report.mjs`,
reusing the existing three-way merge classification and status ordering. The
`initialise-skills` bundle version is bumped `0.6.2` → `0.7.0`
([R-702](https://linear.app/rheged-studio/issue/R-702)).
