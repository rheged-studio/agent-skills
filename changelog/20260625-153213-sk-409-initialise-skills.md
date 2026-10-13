---
title: Add the initialise-skills skill that populates shared skill config
release_note: A new initialise-skills bundle scans the host repo and reconciles every installed skill's config.json with detected facts — base branch, package roots, changelog dir, Linear issue keys and more — idempotently and without clobbering deliberate edits.
created_at: '2026-06-25T15:32:13Z'
merged_at: '2026-06-25T16:12:58Z'
branch: sk-409-add-an-initialise-skills-skill-that-populates-shared-skill
pr: 36
commit: 81bd5c3
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-409
affected_packages:
  - infrastructure
  - initialise-skills
stats:
  files_changed: 17
  loc_added: 1772
  loc_removed: 0
  commits: 6
version: 1.2.0
---

## Added

- **`initialise-skills` skill.** A new bundle that, run inside a host repo,
  reconciles every installed skill's `config.json` with facts detected from the
  repo. It reads each skill's `config.example.json` for the key set and a detector
  registry keyed by config-key name maps facts onto them — so newly-added skills
  are picked up with no change here.
- **Detected facts.** Base branch (`origin/HEAD`), monorepo package roots
  (`pnpm-workspace.yaml` / `workspaces`), changelog directory, Linear issue-key
  prefixes (parsed from branch names), shippable paths, review bots and protected
  branches. The Linear team name and workspace slug are supplied via the Linear
  MCP when available, else flagged for manual input.
- **Idempotent three-way merge.** Each key is classified against its example
  placeholder, the existing value and the detected value — `inferred`,
  `unchanged`, `drift`, `needs-manual-input`, `manual-kept` or `unknown-kept`.
  Deliberate edits (drift) are preserved by default, with a per-key opt-in to
  accept the detected value at the confirmation gate. Writes preserve each file's
  key order and formatting, so a no-op re-run leaves configs byte-identical.
- **Dry-run-first orchestration.** The bundled zero-dependency Node scripts own
  the deterministic detection and merge; the `SKILL.md` drives the dry-run →
  fetch Linear facts → confirm → write → confirm-idempotency flow. A
  `.claude/commands/initialise-skills.md` shim dogfoods it in this repo.

## Changed

- **`preflight` is skipped by the reconcile.** It self-detects its base branch and
  workspaces and reads an optional root-level `preflight.config.json`, so there is
  no in-bundle `config.json` for the new skill to populate.
