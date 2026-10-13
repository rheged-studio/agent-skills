---
title: Per-bundle version-bump check and escape-hatch flags for send-it
release_note: send-it now offers to bump a changed skill bundle's own version (when the repo opts in via bundleVersioning), and gains --base, --title, and --skip-preflight flags.
created_at: '2026-06-24T09:34:56Z'
merged_at: '2026-06-25T09:33:22Z'
branch: sk-388-deferred-upgrades-for-the-consolidated-send-it-skill
pr: 30
commit: fce563a
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-388
affected_packages:
  - infrastructure
stats:
  files_changed: 11
  loc_added: 538
  loc_removed: 68
  commits: 5
version: 1.2.0
---

## Added

- **Per-bundle version-bump check** (`skills/send-it/scripts/check-skill-bumps.mjs`). `validate-skills` enforces that a skill's `package.json` version and `SKILL.md metadata.version` _agree_, but nothing enforced that they were _bumped_ when the bundle's content changed — so an edited skill could ship with a stale version label. The new helper flags `skills/<name>/` bundles whose content changed without a version bump; send-it Step 6 proposes a bump and, on confirmation, edits both files in lockstep before composing the PR title. Gated on a new optional `bundleVersioning` config block, so single-package consumer repos no-op cleanly.
- **`--base=<branch>`** flag — override the configured `baseBranch` for a single run (stacked PRs / non-`main` targets); applies to the fetch, the branch diff, and the PR base.
- **`--title="<subject>"`** flag — set the Conventional Commits PR title verbatim instead of deriving it (escape hatch when derivation picks the wrong type).
- **`--skip-preflight`** flag — bypass the Step 5 lint gate, printing a warning.

## Changed

- Extracted the shared git helpers (`resolveBaseRef`, `readGitCommits`, `readGitBranch`, the `git log` separators) into `skills/send-it/scripts/lib/git.mjs`, reused by both `derive-bump.mjs` and the new `check-skill-bumps.mjs` so they agree on base-ref resolution.
- Bumped the `send-it` bundle to `0.2.0` (dogfooding the new check).
