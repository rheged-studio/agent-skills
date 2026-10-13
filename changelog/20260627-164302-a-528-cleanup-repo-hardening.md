---
title: Harden cleanup-repo's destructive paths and CI-gate them
release_note: 'The cleanup-repo skill now confirms the branch/worktree pass and the filesystem pass separately (with --branches-only / --fs-only scope flags), so you can accept one and decline the other. Squash-merge force-deletion is safer: the merged-PR lookup is scoped to the trunk base, and a branch is only force-deleted when its local tip still matches the merged PR — a branch with post-merge commits is surfaced and skipped. The bundle''s 15-case filesystem self-test is now ported to vitest so the data-deleting paths are CI-gated.'
created_at: '2026-06-27T16:43:02Z'
merged_at: '2026-06-27T17:25:46Z'
branch: a-528-cleanup-repo-add-vitest-coverage-and-ci-wire-the-self-test
pr: 59
commit: ef73d1e
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-528
  - R-530
  - R-537
stats:
  files_changed: 6
  loc_added: 327
  loc_removed: 25
  commits: 1
version: 1.2.0
---

## Added

- **`cleanup-repo` filesystem hygiene is now CI-gated ([R-528](https://linear.app/rheged-studio/issue/R-528)).**
  The bundle's thorough in-script `--self-test` (15 cases over `detect`/`apply`/
  `assertGitRepo`) was never run by `pnpm test`, so a regression in the one skill
  that irreversibly deletes data could land green. Ported to
  `tests/skills/cleanup-repo/filesystem-hygiene.test.ts`.
- **Per-pass confirmation and scope flags ([R-537](https://linear.app/rheged-studio/issue/R-537)).**
  The branch/worktree pass and the filesystem pass are now confirmed **separately**,
  so a user can accept one and decline the other — their blast radii and
  reversibility differ. New `--branches-only` / `--fs-only` scope flags run just one
  pass (mutually exclusive).

## Changed

- **Safer squash-merge force-delete ([R-530](https://linear.app/rheged-studio/issue/R-530)).**
  Pass 2's merged-PR lookup now passes `--base <mainBranch>` so a branch merged into
  a _different_ base isn't mistaken for trunk-merged, and records the merged PR's
  `headRefOid`. A squash-merged branch is force-deleted (`-D`) only when its local
  tip still equals that head — a branch carrying commits added after the merge is
  surfaced in a "Skipped — local tip ahead of merged PR" group rather than having
  its unpushed work silently discarded.

Bundled as `cleanup-repo@0.3.0`.
