---
title: Add the deploy-target changelog enricher (enrich-changelog.mjs)
release_note: Adds enrich-changelog.mjs — the deploy-target post-merge enricher the release orchestrator's daily enrichment cron invokes to fill merged_at / commit / merge_strategy / pr / stats on repos (octavo, shared-workflows) that are never checked out during the release flow, closing the gap where their changelog entries stayed blank. A thin, env-driven wrapper over the tested lib/enrich.mjs, exposed as the changelog:enrich pnpm script; the changelog bundle bumps to 0.9.0.
version: 1.2.0
created_at: '2026-07-03T16:02:58Z'
merged_at: '2026-07-03T16:15:46Z'
branch: a-675-deploy-target-changelog-enrichment-build-enrich-changelogmjs
pr: 91
commit: b7e1aed
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-675
stats:
  files_changed: 8
  loc_added: 448
  loc_removed: 6
  commits: 2
---

## Added

- **`enrich-changelog.mjs` — the deploy-target post-merge changelog enricher
  ([R-675](https://linear.app/rheged-studio/issue/R-675)).** Deploy targets (octavo, shared-workflows) are never checked out during
  the release flow, so — unlike npm targets, which enrich at release time via
  `finalise-changelog.mjs` (`changelog:finalise`) — their entries could only be filled
  afterwards, from the release orchestrator's daily `enrich-changelogs.yml` cron. That
  cron invoked a writer that existed nowhere; this adds it. A thin, dependency-free,
  single-entry wrapper over the built-and-tested `lib/enrich.mjs#enrichFrontmatter`: it
  reads the merged PR's data from the cron's env-var interface (`BRANCH_NAME` /
  `MERGED_AT` / `MERGE_SHA` / `MERGE_STRATEGY` / `PR_NUMBER` / `ADDITIONS` /
  `DELETIONS` / `CHANGED_FILES`), finds the entry by its `branch`, and fills
  `merged_at` / `commit` / `merge_strategy` / `pr` / `stats` fill-once, so re-runs are
  idempotent. It carries `--check` / `--dry-run` / `--self-test` / `--help` parity with
  the other bundled scripts, and a new `changelog:enrich` pnpm script exposes it.

## Changed

- The **`changelog` bundle** bumps to `0.9.0` (minor — new script on the published
  surface), and its SKILL.md / README / changelog-contract now document
  `enrich-changelog.mjs` as the deploy-target counterpart to the npm-target
  `finalise-changelog.mjs`.
