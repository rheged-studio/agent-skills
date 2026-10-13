---
title: Correct release-status default and align changelog/release docs to changelog-core
release_note: release-status now defaults its required check to GO/NO GO, and the changelog/release docs describe the in-repo changelog-core enrichment model.
version: 1.2.7
created_at: '2026-07-13T18:13:33Z'
merged_at: '2026-07-13T18:54:36Z'
branch: a-948-docs-update-changelogrelease-docs-skills-to-the-changelog
pr: 132
commit: 0e4b745
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-948
stats:
  files_changed: 18
  loc_added: 145
  loc_removed: 92
  commits: 5
---

## Fixed

- **`release-status`:** the skill defaulted `requiredCheck` to the decommissioned
  `🔬 Build & Lint` check, so a repo relying on the default reported the required
  check as not-found. Default it to the `GO/NO GO` aggregator that replaced it
  ([R-437](https://linear.app/rheged-studio/issue/R-437) /
  [R-596](https://linear.app/rheged-studio/issue/R-596)) — updated in the
  `DEFAULTS` constant, `config.example.json`, and the docs.

## Changed

- Rewrote the changelog/release documentation across `CLAUDE.md`, the root
  `changelog/README.md`, and the `changelog` + `send-it` skill bundles to describe
  the current model: post-merge enrichment runs **in-repo** via the shared
  `reusable-changelog-enrich.yml` (`mode: enrich` / `mode: finalise`) powered by
  `@acme-skunkworks/changelog-core`, written back as `road-runner-bot[bot]`. The
  release-orchestrator's inline finalise step and the daily `enrich-changelogs.yml`
  cron are retired ([R-801](https://linear.app/rheged-studio/issue/R-801)).
- Dropped `merge_strategy` from the changelog contract, schema, and field lists
  ([R-802](https://linear.app/rheged-studio/issue/R-802)), and removed the now
  unused `changelog:finalise` / `changelog:enrich` npm aliases. The bundled
  finalise/enrich/completeness `.mjs` remain as published skill source.
