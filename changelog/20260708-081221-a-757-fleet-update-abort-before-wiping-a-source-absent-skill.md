---
title: Make the skills fan-out fail-safe against a skill absent from source
release_note: A fleet install profile that named a skill agent-skills does not publish would be deleted from the consumer, because fleet-update wipes each install-set skill's vendored bundle before re-vendoring and the re-vendor could not restore a name that does not exist upstream. fleet-update now validates every install-set skill exists in the source before touching the consumer and aborts with a clear message if any is missing — turning a permanent deletion into a no-op abort, and surfacing a bad manifest under --dry-run too.
created_at: '2026-07-08T08:12:21Z'
branch: a-757-fleet-update-fail-safe-source-existence
category: fix
breaking: false
issues:
  - R-757
merged_at: '2026-07-08T08:18:42Z'
commit: 1c92974
merge_strategy: squash
pr: 120
stats:
  loc_added: 93
  loc_removed: 0
  files_changed: 2
  commits: 2
version: 1.2.4
---

## Fixed

The skills-update fan-out ([R-713](https://linear.app/rheged-studio/issue/R-713))
could **permanently delete a consumer's own skill**. `fleet-update.mjs` wipes
`<mirror>/<skill>` for every skill in the resolved install set **before**
re-vendoring, and re-vendors from `SOURCE_URL@ref`. A profile that named a skill
absent from that source therefore removed the consumer's bundle with no way to
restore it — exactly how a repo-local `initialise-package-repo`, wrongly listed in
the orchestrator's fleet manifest, was deleted on every roll.

**Fail-safe.** Before touching the consumer, `fleet-update` now validates that every
install-set skill exists at `<source>/skills/<skill>/SKILL.md`. If any is missing it
aborts with a message naming the offenders — **before any deletion** — so a permanent
loss becomes a no-op abort. The guard runs ahead of both the apply wipe and the
preview, so `--dry-run` surfaces a bad manifest too. Its core is a pure, injected
`findMissingSourceSkills(skills, probe)`, unit-tested in `--self-test` without a
filesystem.

The orchestrator's `manifest-lint` rejects a non-canonical profile entry at authoring
time; this is the last line of defence when that guard is bypassed (e.g. the fan-out
`repos` canary override).
