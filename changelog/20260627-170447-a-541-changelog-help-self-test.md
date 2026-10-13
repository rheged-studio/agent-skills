---
title: Add --help/--self-test to the changelog scripts and document the full lifecycle
release_note: 'All six changelog bundle scripts now accept --help (concise usage, exits 0 before any real work) and --self-test (an offline smoke test of their pure logic), matching the rest of the estate — so finalise-changelog.mjs --help prints usage instead of doing a real, file-writing run. The SKILL.md and README also now document the whole lifecycle the bundle owns: the authoring scripts the skill runs and the finalisation/CI-gate scripts the consumer wires into its package.json / CI / release orchestrator.'
created_at: '2026-06-27T17:04:47Z'
merged_at: '2026-06-27T17:25:58Z'
branch: a-541-changelog-add-help-self-test-and-document-the-full-lifecycle
pr: 63
commit: 62e3753
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-541
stats:
  files_changed: 10
  loc_added: 569
  loc_removed: 17
  commits: 1
version: 1.2.0
---

## Added

- **`--help` and `--self-test` on every changelog script ([R-541](https://linear.app/rheged-studio/issue/R-541)).**
  All six scripts under `skills/changelog/scripts/` — `add-links`,
  `check-changelog-completeness`, `finalise-changelog`, `preflight-changelog-ci`,
  `set-affected-packages`, and `validate-changelog` — now accept `--help` / `-h`
  (a concise usage string, exits 0 **before** any real work) and `--self-test`
  (an offline smoke test of the script's pure logic — no network, no `gh`, no
  filesystem writes). This brings them in line with the rest of the estate
  (`cleanup-repo`, `triage-pr`). The concrete fix: `finalise-changelog.mjs --help`
  now prints usage instead of doing a real, file-writing release run against
  `package.json` and `gh`.

## Changed

- **The changelog `SKILL.md` and `README.md` now document the full lifecycle the
  bundle owns.** The "Implementation" section previously listed only the authoring
  scripts and said finalisation was "owned by the orchestrator … not invoked here"
  — but `finalise-changelog.mjs`, `check-changelog-completeness.mjs`,
  `lib/enrich.mjs`, and `lib/stamp.mjs` ship **inside this bundle** and are wired
  into the consumer's `package.json` + CI (post-[R-369](https://linear.app/rheged-studio/issue/R-369)). The section now splits the
  scripts into **authoring** (run by the skill) and **finalisation / CI gate** (run
  by the consumer's `package.json` scripts / CI / the release orchestrator), making
  clear which actor runs each, so an adopter wiring the orchestrator/CI gate
  doesn't miss them. Bundled as `changelog@0.6.0`.
