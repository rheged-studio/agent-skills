---
title: Adopt estate skill catalogue and rename initialise-skills to rheged-skills-setup
release_note: Tracked infrastructure/skill-catalogue.json defines the Rheged ship set plus Matt Pocock packs; fleet-update and rheged-skills-setup --install vendor both sources, legacy-wipe initialise-skills, and scope verify to Rheged-only check-updates.
created_at: "2026-09-25T14:49:00Z"
branch: a-1904-adopt-an-estate-skill-catalogue-rheged-matt-pocock-packs
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-1904
merged_at: "2026-09-25T14:26:48Z"
commit: 43b6267
pr: 184
stats:
  loc_added: 7751
  loc_removed: 330
  files_changed: 211
  commits: 8
version: 1.8.0
---

## Changed

- **Estate catalogue ([A-1904](https://linear.app/rheged-studio/issue/A-1904)).**
  [`infrastructure/skill-catalogue.json`](infrastructure/skill-catalogue.json)
  lists Rheged (`rheged-studio/agent-skills`) and Matt (`mattpocock/skills`)
  skill names. `pnpm validate:skills` also runs `validate-catalogue.mjs`.
- **`rheged-skills-setup` (0.11.2 → 0.12.0).** Renamed from `initialise-skills`.
  New `--install` fetches the catalogue, runs `skills add --copy` per source,
  restores clobbered configs ([A-706](https://linear.app/rheged-studio/issue/A-706)), then reconciles. Dogfood skips re-copying
  Rheged into `.claude`/`.agents` mirrors on the source repo.
- **`fleet-update.mjs`.** Multi-source install from the catalogue; wipe includes
  legacy `initialise-skills` bundles; [A-757](https://linear.app/rheged-studio/issue/A-757) probes Rheged names only; verify uses
  Rheged-scoped `check-updates` plus Matt presence checks.
- **Docs.** [`docs/fleet-deployment.md`](docs/fleet-deployment.md) documents the
  catalogue, `--install`, and the rename.
