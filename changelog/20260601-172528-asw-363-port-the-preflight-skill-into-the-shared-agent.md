---
title: Add the preflight skill
release_note: >-
  Adds a preflight skill that is the single source of truth for the
  change-gated, branch-scoped lint preflight.
version: 1.1.0
created_at: '2026-06-01T17:25:28Z'
merged_at: '2026-06-23T19:43:26Z'
branch: asw-363-port-the-preflight-skill-into-the-shared-agent-skills-repo
pr: 24
commit: 41a17fe
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-363
stats:
  files_changed: 12
  loc_added: 1656
  loc_removed: 0
  commits: 4
---

## Added

- New `preflight` skill under `skills/preflight/`: the single source of truth for
  the change-gated, branch-scoped lint preflight — lint only the categories a
  branch touched (ESLint / markdownlint / actionlint) on `origin/<base>...HEAD`
  changed paths, classify each violation as introduced (on a branch-changed line)
  vs pre-existing, and drive the fix/defer loop via an exit-code contract (0 pass,
  1 introduced/blocking, 2 pre-existing only).
- Bundles the zero-dependency `.mjs` scripts (Node built-ins only, no build step):
  `preflight`, `lint-fix`, `classify-lint`, plus shared `scripts/lib` helpers
  (`scope`, `diff-lines`, `paths`).
- Linted workspaces (`pnpm-workspace.yaml` + each package's `lint` script) and the
  base branch (`origin/HEAD`, falling back to `main`) are auto-detected, with an
  optional repo-root `preflight.config.json` override (template shipped as
  `config.example.json`).
- A local `/preflight` command wrapper runs the standalone report/fix flow,
  leaving fixes in the working tree (never commits, pushes, or opens a PR).
