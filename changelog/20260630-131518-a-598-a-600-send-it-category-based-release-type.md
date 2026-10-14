---
title: send-it decides release-type by semantic category, and authors a changelog entry for every PR
release_note: 'send-it now decides whether a change is release-triggering by its semantic category — the Conventional-Commit type of the work it committed — rather than by which paths the diff touches. feat/fix/perf (or any breaking change) cut a release; docs/refactor/chore/ci/build/test/style do not, wherever the files live. This fixes a docs-only edit inside a published path (e.g. a SKILL.md under skills/) being mis-titled feat:/fix: and cutting a spurious release, and mis-recorded in the changelog. The derive-bump helper now emits type, breaking, category, and releaseTriggering alongside the existing bump. Separately, the changelogScope knob is removed: send-it authors a dated changelog entry for every PR (the record-everything-filter-later model), gated only by the changelog: true|false master switch; release notes filter to the version-stamped entries at release time. shippablePaths/shippableManifestKeys are demoted to an advisory publish-surface hint.'
version: 1.2.0
created_at: '2026-06-30T13:15:18Z'
merged_at: '2026-06-30T13:46:11Z'
branch: a-598-a-600-send-it-category-based-release-type
pr: 81
commit: c8df06e
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-598
  - R-600
stats:
  files_changed: 9
  loc_added: 355
  loc_removed: 99
  commits: 3
---

## Changed

- **Release-type is decided by category, not path
  ([R-598](https://linear.app/rheged-studio/issue/R-598)).** send-it previously decided
  whether a PR was release-triggering by whether the diff touched a `shippablePaths` prefix
  (or a publish-surface `package.json` key). It now reads the change's semantic category —
  the Conventional-Commit type of the commits it authored: `feat`/`fix`/`perf`, or any
  breaking change, cut a release; `docs`/`refactor`/`chore`/`ci`/`build`/`test`/`style` do
  not, wherever the files live. A docs-only edit under `skills/` is now `docs:` (no release)
  instead of being mis-titled `feat:`/`fix:`. `derive-bump.mjs` gains `type`, `breaking`,
  `category`, and `releaseTriggering` fields.

- **`shippablePaths` / `shippableManifestKeys` are advisory
  ([R-598](https://linear.app/rheged-studio/issue/R-598)).** They remain in `config.json`
  as a documentation hint of the published surface (and an optional cross-check note), but no
  longer decide release-type.

## Removed

- **The `changelogScope` knob ([R-600](https://linear.app/rheged-studio/issue/R-600)).**
  send-it now authors a dated `changelog/` entry for **every** PR — the "record everything,
  filter later" model — gated only by the `changelog: true|false` master switch. Release notes
  filter the changelog to the version-stamped (release-triggering) entries at release time.
  The `changelogScope: "all" | "shippable"` option (added under [R-576](https://linear.app/rheged-studio/issue/R-576)) is gone. ADR-0003 is
  amended to match.

- The `send-it` bundle bumps to `0.5.0`.
