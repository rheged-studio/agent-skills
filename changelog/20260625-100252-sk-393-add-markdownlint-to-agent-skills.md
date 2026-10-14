---
title: Add markdownlint to the agent-skills toolchain
release_note: agent-skills now lints its Markdown with markdownlint-cli2 against the shared @acme-skunkworks/markdownlint-config, gated in CI and via the send-it → preflight markdown gate; the linear-sync bundle ships a cosmetic table re-alignment (0.1.2).
created_at: '2026-06-25T10:02:52Z'
merged_at: '2026-06-25T10:15:50Z'
branch: sk-393-add-markdownlint-to-agent-skills
pr: 32
commit: 09cecc6
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-393
affected_packages:
  - infrastructure
stats:
  files_changed: 9
  loc_added: 815
  loc_removed: 9
  commits: 4
version: 1.2.0
---

## Added

- **Markdown linting for the repo.** `markdownlint-cli2` + the shared
  `@acme-skunkworks/markdownlint-config` (consumed via `extends`) are now dev
  dependencies, with a root `.markdownlint-cli2.jsonc` (gitignore-aware globs
  mirroring the `preflight` ignore set), `lint:md` / `lint:md:fix` scripts, a
  `lint-staged` entry, and a dedicated `📑 Markdown` CI job. The shared config
  keeps long-form prose and frontmatter-first changelog entries clean
  (MD013/MD033/MD040/MD041 disabled) while staying strict on structure.
- Pairs with [R-406](https://linear.app/rheged-studio/issue/R-406) (the `preflight` text-output parser fix): with the binary
  now installed, the `send-it` → `preflight` markdown gate runs and attributes
  violations end-to-end in this repo.

## Changed

- **`linear-sync` → 0.1.2.** Aligned the state-transition table's pipes
  (markdownlint `MD060`) and normalised an emphasis marker in `CLAUDE.md`
  (`MD049`) — the only two violations the first lint run surfaced across tracked
  docs. Cosmetic only; no behavioural change.
