---
title: Harden the cleanup-repo filesystem-hygiene pass and document its invocation
release_note: The cleanup-repo skill's filesystem-hygiene script now refuses to run against any root without a .git entry, guarding a destructive sweep against a mis-pointed path, and its --self-test (alongside every skill self-test) now runs in CI so a script regression can't ship green. SKILL.md spells out how to resolve the repo root and the bundle-relative script path.
created_at: '2026-06-25T18:05:04Z'
merged_at: '2026-06-25T18:38:58Z'
branch: sk-353-cleanup-repo-follow-up-hardening-ci-self-test-root
pr: 37
commit: 6e704b4
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-353
affected_packages:
  - cleanup-repo
  - infrastructure
stats:
  files_changed: 5
  loc_added: 146
  loc_removed: 4
  commits: 3
version: 1.2.0
---

## Fixed

- **Git-repo safety guard.** `skills/cleanup-repo/scripts/filesystem-hygiene.mjs`
  now refuses to run unless the target root holds a `.git` entry (a directory in a
  primary worktree, a file in a linked one). Defence in depth on a destructive
  tool: a mis-pointed root can no longer sweep recursively-empty directories or
  orphan `node_modules/` outside a repository. A new self-test case covers it.

## Added

- **Skill self-tests run in CI.** `validate.yml`'s skill-manifests job now
  discovers any `skills/*/scripts/*.mjs` shipping a `--self-test` and runs it, so a
  script regression fails the PR instead of shipping green. Discovery is grep-based,
  so future self-testing scripts are picked up automatically.

## Changed

- **`<repo-root>` resolution is documented.** SKILL.md Steps 5 and 9 now say to
  obtain the root with `git rev-parse --show-toplevel` and clarify that the
  `scripts/` path is relative to the skill bundle, not the target repo — removing an
  execution footgun.
- **Expectations on the current branch and usage modes.** SKILL.md notes that the
  branch you're on (or one checked out in a worktree) is auto-skipped by design, and
  that the `Usage modes` examples are skill invocations passed through `$ARGUMENTS`,
  not a standalone CLI.
