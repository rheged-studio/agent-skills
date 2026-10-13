---
title: Consolidate the changelog lifecycle into one zero-dependency bundle
release_note: The changelog lifecycle now lives in a single authored source — the zero-dependency skills/changelog/scripts/*.mjs bundle. finalise, enrich, version-stamping, and the changelog-completeness gate are ported out of the old tsx + gray-matter infrastructure/scripts/*changelog*.ts duplicates into the bundle, so pnpm changelog:finalise and pnpm validate:changelog run under bare node (no tsx, no gray-matter on the changelog path). The bundled validate-changelog.mjs is now the single validator, exporting a pure validateEntry and covering the relaxed required set, semver, breaking-first, and monorepo affected_packages. Linear links are derived from config.json rather than hard-coded.
created_at: '2026-06-27T10:21:46Z'
merged_at: '2026-06-27T11:07:17Z'
branch: sk-369-consolidate-changelog-lifecycle
pr: 48
commit: aa0b6d7
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-369
affected_packages:
  - changelog
  - infrastructure
stats:
  files_changed: 25
  loc_added: 488
  loc_removed: 626
  commits: 5
version: 1.2.0
---

## Added

- **The changelog bundle now carries the full release-time lifecycle.**
  `skills/changelog/scripts/` gains `finalise-changelog.mjs` (the orchestrator
  entrypoint `pnpm changelog:finalise` runs), `lib/enrich.mjs`, `lib/stamp.mjs`, and
  `check-changelog-completeness.mjs` — all zero-dependency, composing the vendored
  frontmatter parser and `config.json` rather than `gray-matter` and hard-coded ACME
  constants. The orchestrator's `pnpm changelog:finalise` contract is unchanged; it
  now resolves under bare `node` (no `tsx`).

## Changed

- **One authored validator.** `validate-changelog.mjs` is now the single source: it
  exports a pure `validateEntry(name, raw)` (guarding its CLI walk behind an
  `import.meta` check) and unifies the previously-divergent rules — the relaxed
  required set (`title`/`created_at`/`category`/`breaking`) so in-flight and
  backfilled entries validate, plus the semver and `## Breaking`-first checks from
  the old `.ts` and the monorepo `affected_packages` check from the bundle.
- **Root scripts and the completeness gate re-pointed at the bundle.**
  `package.json`'s `changelog:finalise` / `validate:changelog` and `validate.yml`'s
  completeness step now invoke the `.mjs` under `node`; the env contract
  (`PR_TITLE` / `BASE_REF`) is preserved.
- **The vendored frontmatter serialiser round-trips an empty mapping as `{}`**
  (mirroring `[]` for empty arrays), so an empty `stats: {}` no longer degrades to
  `stats: null` on re-serialisation.

## Removed

- The duplicated `infrastructure/scripts/*changelog*.ts` sources (and their
  `.test.ts` twins, ported to exercise the `.mjs`) are deleted. `tsx` and
  `gray-matter` remain only for `validate-skills.ts`; taking the repo fully off them
  is a follow-up.
