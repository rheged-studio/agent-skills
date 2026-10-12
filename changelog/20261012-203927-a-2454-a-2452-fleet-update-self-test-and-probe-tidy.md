---
title: run infrastructure self-tests in CI and fix fleet-update test drift
release_note:
created_at: "2026-10-12T20:39:27Z"
merged_at:
branch: a-2454-a-2452-fleet-update-self-test-and-probe-tidy
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: chore
breaking: false
issues:
  - A-2454
  - A-2452
  - A-2298
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
version:
---

## Fixed

- **Fleet-update self-test ([A-2454](https://linear.app/rheged-studio/issue/A-2454)).** Two `resolveWipeTargets` cases in
  `infrastructure/scripts/fleet-update.mjs --self-test` had failed on `main`
  since [A-2298](https://linear.app/rheged-studio/issue/A-2298) added `resolving-merge-conflicts` to `LEGACY_BUNDLE_NAMES`. They
  expected 6 and 2 wipe targets where there are now 8 and 4. The wipe logic was
  right. The cases now work out their expected counts from
  `LEGACY_BUNDLE_NAMES`, so retiring another bundle won't break them again.

## Changed

- **Self-test runner ([A-2454](https://linear.app/rheged-studio/issue/A-2454)).** `pnpm test:self` now also runs the
  `--self-test` mode of the scripts in `infrastructure/scripts/`
  (`bootstrap-config`, `fleet-update`, `fleet-wipe` and `vendor-sync`), not
  just the skill scripts, so CI catches the next drift. The runner skips
  itself.
- **Fleet-update source probe ([A-2452](https://linear.app/rheged-studio/issue/A-2452)).** `resolveSourceProbeSkills` now
  probes the install list minus the Matt Pocock names, and drops a union that
  never added anything. Its result is unchanged. The unused
  `findMissingRhegedSourceSkills` export is removed from `rheged-skills-setup`,
  which moves to 0.14.1.
