---
title: cleanup-repo stops reading PR titles and Linear issue text
release_note: cleanup-repo no longer reads pull request titles or Linear issue titles and descriptions, and documents its delete safeguards and untrusted inputs.
created_at: "2026-10-16T17:06:18Z"
merged_at:
branch: r-2873-cleanup-repo-stop-ingesting-pr-titles-and-linear-text-to
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - R-2873
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Fixed

- **cleanup-repo no longer reads outsider-authored PR or Linear text ([R-2873](https://linear.app/rheged-studio/issue/R-2873)).** The squash-merge lookup now asks `gh pr list` for `number,headRefOid` only, so pull request titles never enter context; summaries show `#<number>` instead. Every Linear `get_issue` call uses field selection (`id`, `status`, `statusType`, `team`), so issue titles and descriptions are never read, and the Done-writeback prompt lists only issue IDs and their current state. This addresses the Snyk W011 third-party content exposure finding.
- **The trunk is always protected.** `mainBranch` is now treated as protected whether or not it appears in `protectedBranches`.

## Added

- **A "Scope and safeguards" section** listing the skill's delete commands, its per-pass confirmation gates, the `--dry-run` preview, and everything it never deletes.
- **An "Untrusted input" section** naming the remaining ingestion points (branch names, working-tree paths, Linear team and state names) and how each is handled as data, never instructions — including passing branch names and paths to `git` and `gh` as quoted arguments, never raw shell text.

## Changed

- **cleanup-repo patch-bumped to 0.5.3.**
