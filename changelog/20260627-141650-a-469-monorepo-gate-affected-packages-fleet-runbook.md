---
title: Monorepo-gate changelog affected_packages, close skill-script test gaps, add the fleet deployment runbook
release_note: The changelog skill now gates its affected_packages field behind a new affectedPackages config flag, defaulting off so single-package repos stop emitting the redundant field while genuine monorepos keep it (initialise-skills turns it on automatically when it detects a workspace). A documented fleet wipe->install->reconcile->verify runbook and a wipe helper land for rolling the shared skills onto a repo, alongside broader test coverage across the bundled skill scripts.
created_at: '2026-06-27T14:16:50Z'
merged_at: '2026-06-27T14:44:14Z'
branch: a-469-tier-1-changelog-dependent-deployment-prep-work-run-in
pr: 52
commit: 240ad93
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-469
  - R-461
  - R-464
  - R-465
stats:
  files_changed: 34
  loc_added: 1406
  loc_removed: 113
  commits: 5
version: 1.2.0
---

## Added

- **`affectedPackages` config flag for the `changelog` skill ([R-461](https://linear.app/rheged-studio/issue/R-461)).** A new
  boolean in the changelog `config.json` (default `false`) decides whether the
  `affected_packages` field is emitted at all. Single-package repos leave it off
  and get clean entries — the field was write-only and redundant there — while
  genuine monorepos set it `true`. The choice is an explicit flag rather than an
  inference from `packageRoots`, because a real monorepo can use a single root
  (`["packages"]`), which a length check would mis-gate. `initialise-skills`
  derives the flag from the same workspace signal as `packageRoots`, so monorepos
  opt in automatically on reconcile.
- **Fleet deployment runbook and wipe helper ([R-464](https://linear.app/rheged-studio/issue/R-464)).**
  `docs/fleet-deployment.md` documents the repeatable
  wipe→install→reconcile→verify mechanism every per-repo skill migration shares —
  the install-set per repo type, tag-pinning, and the re-install/upgrade path.
  `infrastructure/scripts/fleet-wipe.mjs` previews and removes a target repo's
  bespoke command shims (safe by default: it never deletes vendored skill
  bundles, only lists them for manual review; ships a `--self-test`).
- **Test coverage for the previously-untested bundled skill scripts ([R-465](https://linear.app/rheged-studio/issue/R-465)).**
  New vitest suites cover `scope.mjs`, `report.mjs`, `discover.mjs`, the
  `preflight-changelog-ci.mjs` version helpers, the `initialise.mjs` argument/drift
  helpers, `lint-fix.mjs` command planning, and `preflight.mjs` summary assembly,
  plus added edge cases for `parseWorkspaceGlobs`.

## Changed

- **`set-affected-packages.mjs` no-ops when `affectedPackages` is off ([R-461](https://linear.app/rheged-studio/issue/R-461)).**
  In both normal and `--check` modes it exits 0 without rewriting, so CI never
  demands the field on a single-package repo. This repo sets
  `affectedPackages: false` — so this very entry carries no `affected_packages`.
- **Pure logic extracted to exports behind the CLI guard ([R-465](https://linear.app/rheged-studio/issue/R-465)).** The version
  helpers in `preflight-changelog-ci.mjs`, `planFixCommands` in `lint-fix.mjs`,
  `buildSummary` in `preflight.mjs`, and the argument/drift helpers in
  `initialise.mjs` are now exported and importable without running the CLI, with
  no change to runtime behaviour.
