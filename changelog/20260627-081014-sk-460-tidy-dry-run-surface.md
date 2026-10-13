---
title: Tidy the dry-run/preview surface R-458 surfaced
release_note: Fixes the three minor issues the R-458 dry-run smoke pass surfaced. initialise-skills no longer fabricates package roots — detectPackageRoots existence-filters its hard-coded fallback and reports "couldn't detect" when no workspace manifest and no candidate directory exist, so a repo without apps/packages/services dirs sees its packageRoots kept (manual-kept) instead of phantom drift, and a fresh repo is flagged needs-manual-input rather than having fabricated dirs written into config. triage-pr's read-only review-threads fetcher is now documented as having no --dry-run (the writer respond-threads is where it lives), and the send-it and cleanup-repo JSON-output helpers (derive-bump, check-skill-bumps, filesystem-hygiene) gain a --help flag.
created_at: '2026-06-27T08:10:14Z'
merged_at: '2026-06-27T08:51:58Z'
branch: sk-460-tidy-dry-run-surface
pr: 47
commit: 3cfd909
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-460
affected_packages:
  - cleanup-repo
  - infrastructure
  - initialise-skills
  - send-it
  - triage-pr
stats:
  files_changed: 17
  loc_added: 288
  loc_removed: 16
  commits: 7
version: 1.2.0
---

## Fixed

- **`initialise-skills` no longer reports phantom `packageRoots`.** `detectPackageRoots`
  used to fall back to a hard-coded `["apps","packages","services"]` whenever a repo
  had no `pnpm-workspace.yaml` and no root `workspaces` field — so a repo without those
  directories "detected" three roots that don't exist, producing phantom drift, and a
  fresh repo with no existing value would have had those fabricated roots written into
  its `config.json`. The fallback now existence-filters to candidates actually present
  on disk, and an empty result maps to `null` ("couldn't detect"): the merge keeps the
  existing value (`manual-kept`) or flags `needs-manual-input` rather than writing a
  guess. Declared workspace globs remain authoritative. Adds workspace + detector unit
  coverage.

## Added

- **`--help` on the JSON-output helpers** — `send-it`'s `derive-bump.mjs` and
  `check-skill-bumps.mjs`, and `cleanup-repo`'s `filesystem-hygiene.mjs` previously
  ignored unknown flags silently; each now has a `--help`/`-h` early-return printing
  usage, matching the `initialise.mjs` / `respond-threads.mjs` convention.

## Changed

- **`triage-pr`'s `review-threads.mjs` documented as read-only.** It is a pure
  fetch-and-print (`gh api graphql`) with no write path, so it deliberately has no
  `--dry-run` — the writer `respond-threads.mjs` is where `--dry-run` belongs. Noted
  in the script header and SKILL.md Step 7 so it isn't mistaken for a gap.

Each changed bundle's `package.json` version and `SKILL.md metadata.version` are bumped
in lockstep (patch): initialise-skills `0.3.1`, triage-pr `0.3.2`, send-it `0.3.1`,
cleanup-repo `0.2.1`.
