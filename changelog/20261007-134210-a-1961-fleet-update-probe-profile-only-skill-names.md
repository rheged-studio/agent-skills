---
title: probe profile-only skills in the fleet-update A-757 guard
release_note: >-
  fleet-update now refuses to wipe a consumer when its profile lists a skill
  that is outside the catalogue and absent from agent-skills, instead of
  deleting that bundle with no way to re-vendor it.
created_at: "2026-10-07T13:42:10Z"
merged_at:
branch: a-1961-fleet-update-probe-profile-only-skill-names
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - A-1961
  - A-757
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
---

## Fixed

- **Fleet update ([A-1961](https://linear.app/rheged-studio/issue/A-1961)).** The [A-757](https://linear.app/rheged-studio/issue/A-757) pre-apply guard in
  `infrastructure/scripts/fleet-update.mjs` only probed the catalogue's Rheged
  skill names. An explicit profile `skills` list is passed as-is to the Rheged
  `skills add`, and its bundles are wiped first. So a repo-local extra still
  listed in the profile skipped the guard and could be deleted.
- The guard now probes the union of the catalogue's Rheged names and the
  profile's Rheged install list, via a new pure `resolveSourceProbeSkills`
  helper. Matt Pocock catalogue names are still left out: they re-vendor from
  their own source and are checked after install.
- New Vitest and `--self-test` cases cover a profile-only name being probed
  and a Matt name not being probed.
