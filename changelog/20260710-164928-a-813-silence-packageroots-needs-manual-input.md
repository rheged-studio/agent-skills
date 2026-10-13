---
title: Silence packageRoots needs-manual-input on single-package hosts
release_note: initialise-skills no longer flags changelog.packageRoots as needs-manual-input when affectedPackages is false, and documents the single↔monorepo config flip.
created_at: '2026-07-10T16:49:28Z'
branch: a-813-initialise-skills-skip-or-clear-packageroots-on-single
category: fix
breaking: false
issues:
  - R-813
merged_at: '2026-07-10T17:26:05Z'
commit: 8c134f7
pr: 125
stats:
  loc_added: 332
  loc_removed: 5
  files_changed: 8
  commits: 4
version: 1.2.5
---

## Fixed

- **`packageRoots` gated by `affectedPackages` ([R-813](https://linear.app/rheged-studio/issue/R-813)).**
  On a single-package host the roots detector still returns null, but with
  `affectedPackages: false` the merge reclassifies `packageRoots` from
  `needs-manual-input` to `unchanged` and leaves the example placeholder in
  place. Runtime already ignored those roots when the gate was off; the report
  no longer trains operators to fill monorepo knobs they do not need. Bundled as
  `initialise-skills@0.10.7`.

## Added

- **`references/monorepo-config.md`** — agent-facing guide for the single↔monorepo
  flip (`acceptDrift` / `--set` when a prior `false` is drift), linked from
  `SKILL.md`, `detectable-keys.md`, and `docs/fleet-deployment.md`.
