---
title: Adopt changelog-core and in-repo post-merge enrich
release_note: Post-merge changelog finalise now runs in-repo via reusable-changelog-enrich and @acme-skunkworks/changelog-core instead of the orchestrator's inline Finalise step.
created_at: '2026-07-10T14:13:13Z'
branch: a-797-phase-3-roll-out-in-repo-enricher-to-agent-skills-npm
category: chore
breaking: false
issues:
  - R-797
merged_at: '2026-07-10T14:30:22Z'
commit: 344b516
pr: 123
stats:
  loc_added: 58
  loc_removed: 3
  files_changed: 6
  commits: 3
version: 1.2.5
---

## Changed

Migrate `agent-skills` onto the in-repo post-merge enricher (Phase 3 · [R-797](https://linear.app/rheged-studio/issue/R-797)),
following the eslint-config canary:

- Add `@acme-skunkworks/changelog-core` and point CI `validate:changelog` /
  completeness at it.
- Fold `reusable-changelog-enrich.yml` (`mode: finalise`, pinned at [R-821](https://linear.app/rheged-studio/issue/R-821) SHA)
  into `pkg-release.yml` with `secrets: inherit` for road-runner-bot write-back.
- Keep `skills/changelog/scripts/*` as the published skill source — CI no longer
  shells out to them for validate/completeness.
