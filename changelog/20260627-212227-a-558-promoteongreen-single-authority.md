---
title: Make promoteOnGreen the single proceed-on-green authority in triage-pr
release_note: 'The triage-pr skill''s prose no longer contradicts its config: promoteOnGreen is now documented as the single repo-level control for the draft→ready flip, and an enabled config IS the human authorisation — an agent proceeds on proven-green CI without seeking a separate sign-off. The stale ''never flip — that is the human''s call'' line is gone from the command shim, config.example.json and the initialise-skills detector default now match the default-on model, and the existing promotion gates (proven-green, no unresolved human threads, no base drift) and manual-merge behaviour are unchanged.'
created_at: '2026-06-27T21:22:27Z'
merged_at: '2026-06-27T22:06:50Z'
branch: a-558-promoteongreen-single-authority
pr: 68
commit: 4b23f54
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-558
stats:
  files_changed: 10
  loc_added: 98
  loc_removed: 35
  commits: 6
version: 1.2.0
---

## Fixed

- **`promoteOnGreen` is now the single proceed-on-green authority ([R-558](https://linear.app/rheged-studio/issue/R-558)).**
  [R-526](https://linear.app/rheged-studio/issue/R-526) made flipping a proven-green draft to ready the default (`promoteOnGreen: true`),
  but the surrounding prose still encoded the old human-authorisation gate, so an agent
  reading the skill was told to both proceed and not proceed. The `.claude/commands/triage-pr.md`
  shim's "Never flip the PR from draft to ready — that is the human's call" line is
  removed; `SKILL.md`, `README.md`, and the shim now agree that `promoteOnGreen` is the
  single control for the draft→ready flip and that **an enabled config is the
  authorisation** — agents proceed on proven green without seeking a separate sign-off,
  while an explicit user prompt (or `--promote` / `--no-promote`) still overrides per run.

## Changed

- **`config.example.json` and the `initialise-skills` detector default now match the
  default-on model.** `skills/triage-pr/config.example.json` ships `promoteOnGreen: true`
  (preserving config/example key parity), and the `initialise-skills` detector infers
  `true` rather than the old opt-in `false`, so a freshly reconciled repo gets the
  current default. The promotion safety gates (proven-green CI, no unresolved human
  threads, no `BEHIND` / `DIRTY` base drift) and the manual-merge boundary are unchanged.
  Bundled as `triage-pr@0.4.3` and `initialise-skills@0.4.2`.
