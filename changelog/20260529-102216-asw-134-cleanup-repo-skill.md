---
title: "Add the cleanup-repo skill"
release_note: "New cleanup-repo skill — prunes merged branches and worktrees, empty directories, and orphaned node_modules, with a dry-run preview."
version: "0.0.1"
created_at: "2026-05-29T10:22:16Z"
merged_at: "2026-06-01T13:59:47Z"
branch: "asw-134-build-cleanup-repo-skill"
pr: 9
commit: "a0263ac"
merge_strategy: squash
author: "rob@acmeskunkworks.io"
co_authors: []
category: feature
breaking: false
issues: ["R-134"]
stats:
  files_changed: 9
  loc_added: 818
  loc_removed: 0
  commits: 10
---

## Added

- `cleanup-repo` skill at `skills/cleanup-repo/` — the first skills.sh bundle in the repo, conforming to ADR-0001's layout (`SKILL.md` + `package.json` named `@acme-skunkworks/skill-cleanup-repo`).
- A branch/worktree pass (a faithful port of Octavo's `/cleanup-branches`: two-pass merge detection, an uncommitted-changes worktree guard, protected branches, and an opt-in, default-no Linear `Done` writeback) and a new filesystem-hygiene pass (`scripts/filesystem-hygiene.mjs`) that prunes top-most recursively-empty directories and orphaned `node_modules/`, with a `--dry-run` preview matching the real run.
- A `skills-ref validate` manifest-lint gate in `validate.yml`.
