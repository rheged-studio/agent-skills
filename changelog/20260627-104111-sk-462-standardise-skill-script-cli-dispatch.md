---
title: Standardise skill-script CLI dispatch and harden pnpm-workspace detection
release_note: 'Every bundled skill script now uses the same realpath-safe CLI-entry guard (isCliEntry()) and handles --help inside main(), replacing the four divergent guard styles — two of which used a plain path compare that breaks under symlinks (macOS /var→/private/var, pnpm''s store). initialise-skills also stops fabricating package roots: a present pnpm-workspace.yaml is now authoritative, so a catalogs:-only file (pnpm ≥9.5) or an empty packages: list yields no roots rather than guessing from whatever apps/packages/services directories happen to exist.'
created_at: '2026-06-27T10:41:11Z'
merged_at: '2026-06-27T11:07:32Z'
branch: sk-462-standardise-skill-script-cli-dispatch
pr: 49
commit: 99d01cb
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-462
affected_packages:
  - cleanup-repo
  - infrastructure
  - initialise-skills
  - preflight
  - send-it
stats:
  files_changed: 17
  loc_added: 278
  loc_removed: 67
  commits: 5
version: 1.2.0
---

## Fixed

- **`initialise-skills` no longer fabricates package roots for a roots-less pnpm
  workspace.** `detectPackageRoots` used to fall through to the package.json
  `workspaces` field and then the existence-filtered default whenever
  `pnpm-workspace.yaml` declared no `packages:` globs — so a `catalogs:`-only file
  (pnpm ≥9.5) or `packages: []` would pick up whatever `apps/`/`packages/`/
  `services/` directories happened to exist as "detected" roots. A present
  manifest is now authoritative: its declared roots are returned verbatim
  (`[]` when none), which the caller maps to couldn't-detect (keep existing config
  / flag for manual input) — the same no-invented-roots rule [R-460](https://linear.app/rheged-studio/issue/R-460) established.

## Changed

- **One CLI-dispatch convention across the bundled scripts.** Every entry script
  (`filesystem-hygiene`, `initialise`, `preflight`, `lint-fix`, `derive-bump`,
  `check-skill-bumps`) now runs `main()` behind the realpath-safe `isCliEntry()`
  guard and handles `--help`/`-h` inside `main()`. This replaces the four previous
  guard styles — including the `import.meta.filename === argv[1]` and
  `import.meta.url === pathToFileURL(...)` compares, which return a false negative
  under symlinks (macOS `/var`→`/private/var`, pnpm's symlinked store) and so could
  skip `main()` when the script was invoked through one. `derive-bump` /
  `check-skill-bumps` move their `--help` handling out of the module-level guard
  into `main()` and their `USAGE` constants above `main()`.
