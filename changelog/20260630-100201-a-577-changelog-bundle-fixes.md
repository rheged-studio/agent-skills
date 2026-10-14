---
title: changelog bundle fixes — reentrant add-links unmask, finalise stats.commits gate, and backfill indent
release_note: Three corrective fixes to the changelog skill bundle. add-links is now reentrant when unmasking, so inline code nested inside a Markdown link (`[`code`](url)`) no longer leaks NUL bytes and corrupts the entry into a binary blob. finalise-changelog's needsEnrich gate now treats a populated-but-commits-less stats block as enrichable, so an entry finalised in the window between stats and stats.commits existing still gets its commit count backfilled rather than being version-stamped without it forever. backfill-commits derives the stats-child indent from the block itself instead of hard-coding two spaces, so a deeper-indented stats block splices the commits line at the correct depth.
version: 1.2.0
created_at: '2026-06-30T10:02:01Z'
merged_at: '2026-06-30T12:49:30Z'
branch: a-577-changelog-bundle-fixes
pr: 76
commit: 263a32b
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-577
  - R-579
  - R-581
stats:
  files_changed: 9
  loc_added: 195
  loc_removed: 11
  commits: 6
---

## Fixed

- **`add-links` no longer corrupts an entry when inline code is nested inside a link
  ([R-577](https://linear.app/rheged-studio/issue/R-577)).** The masker replaces fenced code,
  inline code, and existing links with NUL-delimited placeholder tokens before linkifying bare
  issue IDs, then restores them. The restore was a single pass, so a span like `` [`code`](url) ``
  — where the inner inline-code mask sits inside the outer already-linked mask — restored the outer
  token to a value that still embedded the inner token, leaving literal NUL bytes in the file (`git`
  reports "Binary files differ"). The unmask now runs to a fixed point, so arbitrarily nested masks
  fully restore. A `--self-test` case and a vitest regression cover inline-code-inside-a-link.

- **`finalise-changelog` re-enriches an entry whose `stats` block has no `commits` child
  ([R-579](https://linear.app/rheged-studio/issue/R-579)).** The `needsEnrich` gate tested
  `blank(fm.stats)` (the object), not `blank(fm.stats.commits)`. An entry with `merged_at`/`commit`/`pr`
  set and a populated `stats` block but no `commits` child therefore skipped enrichment and was
  version-stamped without it — and the line-63 short-circuit then made the missing count
  un-backfillable through finalise forever. The gate now also enriches when `stats.commits` is blank.

- **`backfill-commits` mirrors the stats-block indent instead of assuming two spaces
  ([R-581](https://linear.app/rheged-studio/issue/R-581)).** `setStatsCommits()` walked the
  indented children of the `stats:` block but spliced the new `commits:` line with a hard-coded
  two-space indent, so a four-space block would be mis-nested. It now derives the child indent from
  the block itself and reuses it.

## Changed

- The `changelog` bundle bumps to `0.7.1`. The five merged consumer copies pick the fixes up on
  their next shared-skills re-sync (they vendor byte-identical source).
