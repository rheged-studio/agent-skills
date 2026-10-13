---
title: Externalise the changelog skill's repo-structure config and fail loud on identity keys
release_note: The changelog skill (0.2.0) now reads changelogDir, packageRoots and fallbackPackage from config.json and fails loudly when issueKeys or linearWorkspaceSlug are absent, so a foreign repo can no longer silently inherit ACME's issue keys or workspace slug.
created_at: '2026-06-25T12:54:53Z'
merged_at: '2026-06-25T13:58:00Z'
branch: sk-407-pull-repo-specific-code-out-of-the-shared-skills-into-config
pr: 34
commit: 24078f6
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-407
affected_packages:
  - infrastructure
stats:
  files_changed: 13
  loc_added: 400
  loc_removed: 57
  commits: 4
version: 1.2.0
---

## Added

- **Three new `changelog` config keys**, all with generic overridable defaults so
  the bundle drops into any repo layout: `changelogDir` (the dated-entries
  directory, default `changelog`), `packageRoots` (monorepo dir prefixes mapping
  `<root>/<x>/…` → package `<x>`, default `["apps", "packages", "services"]`) and
  `fallbackPackage` (default `infrastructure`). `config.example.json`, the README
  and `SKILL.md` config tables document all six keys.

## Changed

- **Identity config now fails loudly.** `issueKeys` and `linearWorkspaceSlug` have
  no default — a missing `config.json`, or either key absent, throws an actionable
  error instead of silently inheriting ACME's identity (which would emit wrong
  issue-ID detection and Linear links in a foreign repo). Structural keys keep
  generic, non-ACME defaults.
- **The monorepo path→package mapping is config-driven.** `derive-packages.mjs`
  builds its rule from `packageRoots`/`fallbackPackage` rather than the previously
  hardcoded `apps/`/`packages/`/`services/` → `infrastructure`, and the changelog
  directory it skips comes from `changelogDir`.
- **The changelog directory is read from config** in `validate-changelog.mjs`,
  `add-links.mjs` and `set-affected-packages.mjs`, replacing two separate inline
  `"changelog"` constants that could drift.
- Scope is the distributed bundle only (`skills/changelog/`); this repo's
  agent-skills-internal `infrastructure/scripts/*.ts` release tooling is unchanged.
