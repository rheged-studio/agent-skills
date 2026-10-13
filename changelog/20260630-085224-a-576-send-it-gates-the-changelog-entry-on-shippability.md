---
title: send-it gains a changelogScope opt-in so every PR can get a changelog entry
release_note: send-it's config gains a changelogScope knob that decouples changelog authoring from the shippability decision. The default "all" authors a dated changelog/ entry for every PR — shippable and non-shippable alike — so the changelog is a full record of merged work (release notes still filter to the version-stamped, shippable entries); "shippable" preserves the previous behaviour of mirroring only the published-change surface. The PR-title release type stays coupled to shippability, so docs/chore PRs still cut no release. This restores the every-PR changelog convention that repos like Octavo rely on, with the fix contained entirely in send-it (the changelog skill is unchanged).
version: 1.2.0
created_at: '2026-06-30T08:52:24Z'
merged_at: '2026-06-30T09:46:12Z'
branch: a-576-send-it-gates-the-changelog-entry-on-shippability-octavo
pr: 75
commit: 583d2fb
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-576
stats:
  files_changed: 6
  loc_added: 96
  loc_removed: 24
  commits: 3
---

## Added

- **`send-it` gains a `changelogScope` config knob ([R-576](https://linear.app/rheged-studio/issue/R-576)).**
  Until now `send-it` authored a dated `changelog/` entry **only for shippable changes** — the
  same shippability decision that drives the PR title also gated whether an entry existed. That
  conflated two independent concerns: the PR-title release type (the release-please/npm signal,
  which _must_ stay coupled to shippability so docs/chore PRs cut no release) and whether a
  changelog entry is written at all. `changelogScope` separates them:
  - **`"all"`** (the default) authors an entry for **every** PR, shippable and non-shippable. The
    dated changelog becomes a full record of merged work; release notes still filter it to the
    version-stamped (shippable) entries, so a non-shippable entry simply carries no `version`.
  - **`"shippable"`** preserves the prior behaviour — an entry only for shippable changes, so the
    changelog mirrors just the published-change surface.

  `changelog: false` still disables Steps 7–8 outright. For a non-shippable entry (only reached
  under `"all"`), `category` follows the non-release PR-title type (`docs`/`refactor`/`perf`, or
  `chore` for `chore`/`ci`/`build`/`test`/`style`) and `breaking` is always `false`.

## Changed

- **The fix is contained entirely in `send-it`.** The `changelog` skill is unchanged — it already
  authors any category, and `set-affected-packages.mjs` already tags non-shippable paths via
  `fallbackPackage`. `send-it`'s `config.json` and `config.example.json` both gain
  `changelogScope: "all"`, and the bundle bumps to `0.4.0`. Consumer repos that mirror every PR
  into their changelog (e.g. Octavo) get the restored behaviour on their next shared-skills
  re-sync; repos that want a release-notes-only changelog set `changelogScope: "shippable"`.
