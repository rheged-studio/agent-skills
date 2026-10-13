---
title: Generate per-skill config.json instead of vendoring it into consumers
release_note: skills add --copy used to vendor agent-skills' own config.json for every skill into the consuming repo, so a fresh install silently inherited this repo's values (R-554) and every upgrade re-vendored them, overwriting deliberate no-detector edits (R-612). The per-skill config.json is now gitignored and excluded from the published tarball, so the only config a consumer receives is the neutral config.example.json — initialise-skills generates config.json from it on install, and upgrades never touch a consumer's own config.json. This repo's real (dogfood) values move to a tracked infrastructure/dogfood-config/ tree, materialised into the gitignored config.json by a new pnpm bootstrap:config (run once after clone; auto-run in CI and via the pre* hooks of the scripts that read a config). The config-key parity guard now validates the dogfood configs against each config.example.json.
version: 1.2.0
created_at: '2026-06-30T16:39:30Z'
merged_at: '2026-06-30T16:51:40Z'
branch: a-615-stop-vendoring-agent-skills-own-configjson-into-consumers
pr: 83
commit: c2a7fdb
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-615
stats:
  files_changed: 37
  loc_added: 571
  loc_removed: 97
  commits: 4
---

## Fixed

- **`skills add --copy` no longer vendors this repo's own `config.json` into consumers
  ([R-615](https://linear.app/rheged-studio/issue/R-615)).** skills.sh copies every
  tracked file under `skills/<name>/`, and there is no ignore mechanism (ADR-0001
  Decision 4), so a tracked `config.json` leaked agent-skills' values into the consuming
  repo — a fresh install silently inherited them ([R-554](https://linear.app/rheged-studio/issue/R-554))
  and every upgrade re-vendored them, regressing deliberate no-detector edits
  ([R-612](https://linear.app/rheged-studio/issue/R-612)). `skills/*/config.json` is now
  gitignored and excluded from the npm tarball (`files: ["!skills/*/config.json"]`), so
  only the neutral `config.example.json` ships. On a fresh install `initialise-skills`
  generates `config.json` from the example baseline; on upgrade the consumer's own
  `config.json` is never touched.

## Added

- **`pnpm bootstrap:config`** (`infrastructure/scripts/bootstrap-config.mjs`,
  zero-dependency, with `--check` / `--self-test`). agent-skills' real config values now
  live in the tracked `infrastructure/dogfood-config/<name>.json` tree (outside the
  vendored bundle); this script materialises them into the gitignored
  `skills/<name>/config.json` so the repo's own skills, tests, and CI gates work. It is
  wired into CI (a dedicated step) and the `pre*` npm hooks of every script that reads a
  config (`pretest`, `pretest:self`, `prevalidate:changelog`, `prechangelog:finalise`), so
  CI and fresh clones self-heal.

## Changed

- **`validate:skills` config-key parity** now compares each `config.example.json` against
  the tracked `infrastructure/dogfood-config/<name>.json` rather than the (now gitignored)
  `skills/<name>/config.json`, preserving the [R-538](https://linear.app/rheged-studio/issue/R-538)
  guard.
- **Fleet-deployment runbook** drops the "reset each `config.json` from its example" step
  (now four steps: wipe → install → reconcile → verify); the skill READMEs and `CLAUDE.md`
  are updated to describe the generated `config.json`.
- The `changelog`, `cleanup-repo`, `linear-sync`, `release-status`, `scaffold-new-skill`,
  `send-it`, and `triage-pr` bundles bump a patch level (their shipped surface no longer
  includes `config.json`).
