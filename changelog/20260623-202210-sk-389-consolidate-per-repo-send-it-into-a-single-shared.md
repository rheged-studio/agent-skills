---
title: Add the shared send-it skill
release_note: 'New send-it skill — the all-in-one ship finisher: bundles uncommitted work into atomic commits, runs the change-gated lint preflight, authors the dated changelog entry, composes a Conventional Commits PR title, pushes, opens or updates a PR, and moves linked Linear issues to In Review. A thin orchestrator delegating to the preflight, changelog, and linear-sync skills.'
version: 1.2.0
created_at: '2026-06-23T20:22:10Z'
merged_at: '2026-06-24T08:00:51Z'
branch: sk-389-consolidate-per-repo-send-it-into-a-single-shared-agent
pr: 28
commit: 3196d33
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-389
stats:
  files_changed: 18
  loc_added: 737
  loc_removed: 406
  commits: 5
---

## Added

- `send-it` skill at `skills/send-it/` — a skills.sh bundle (`SKILL.md` + `package.json` named `@acme-skunkworks/skill-send-it`) conforming to ADR-0001's layout. It is the all-in-one ship finisher and a **thin orchestrator**: it owns the branch guard, worktree resolution, atomic commits, the shippability decision, Conventional Commits PR-title composition, push, and the PR — and delegates the lint gate to the `preflight` skill, changelog authoring/validation to the `changelog` skill, and the In Review writeback to the `linear-sync` skill.
- A zero-dependency `scripts/derive-bump.mjs` helper (Node built-ins only — no `tsx`) that derives the branch slug, the semver bump (`major`/`minor`/`patch`) from the branch's Conventional-Commit subjects, and a draft summary body. Its slug/bump/body logic is covered by `infrastructure/tests/derive-bump.test.ts` (14 cases).
- Per-consumer parameterisation via `config.json`: `baseBranch`, `shippablePaths`, and `shippableManifestKeys` decide whether a change is shippable (release-triggering) without hard-coding any repo's layout, so one skill serves monorepos and single-package repos alike. A neutral `config.example.json` ships as a template.
- Folded-in dogfooding fixes: the bump helper now runs as plain `node` (no `pnpm tsx` resolution failure), and the `--worktree` flow runs `pnpm install --frozen-lockfile` when `node_modules` is absent so a fresh worktree is self-sufficient. The change-gated `preflight` lint gate is now part of the flow.

## Changed

- This repo now dogfoods the shared skill: `.claude/commands/send-it.md` is a thin shim that follows `skills/send-it/SKILL.md` (matching the existing `/preflight`, `/changelog`, and `/linear-sync` shims), replacing the previous stopgap copy. The standalone `infrastructure/send-it/derive-changeset.ts` helper and its test were removed in favour of the in-bundle `derive-bump.mjs`.
- `linear-sync` and `changelog` recognise the current `SK` team key: it was added to each skill's `config.json` `issueKeys` (joining the legacy `ASW`/`AKW`/`SKW`), so send-it's Linear writeback and the changelog's issue-linking match current-key issues. Both skills' `metadata.version` bumped to `0.1.1`.
