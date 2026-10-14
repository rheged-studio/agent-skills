---
title: Recompute merge changed flag after --set overrides and default fleet-update to the canonical skill set
release_note: 'initialise-skills'' config reconcile no longer reports a change when a --set restores a key that detection had inferred away: mergeConfig now derives its changed flag once from the final merged config versus the original, instead of accumulating a monotonic flag the --set loop could never clear — so a --set that nets back to the original value is correctly a no-op. Separately, the fleet-update tooling that rolls a consumer repo onto the shared bundles now defaults to the explicit canonical skill set when a profile omits skills, rather than a bare install that vendored the entire published set (including the repo-internal scaffold-new-skill).'
created_at: '2026-07-06T20:25:00Z'
merged_at: '2026-07-06T20:33:27Z'
branch: a-728-recompute-changed-and-fleet-update-canonical-default
pr: 110
commit: 2cf723c
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-728
  - R-729
stats:
  files_changed: 7
  loc_added: 131
  loc_removed: 42
  commits: 1
version: 1.2.0
---

## Fixed

Two defects in the canonical bundle source, surfaced by CodeRabbit's review of the
[R-681](https://linear.app/rheged-studio/issue/R-681) Wave C/D consumer re-vendor and filed under the
[R-573](https://linear.app/rheged-studio/issue/R-573) collector. Fixed upstream here; they propagate to
consumers on the next sync.

**`initialise-skills` (0.10.2 → 0.10.3) — `changed` recomputed from the net result
([R-728](https://linear.app/rheged-studio/issue/R-728)).** `mergeConfig` accumulated a monotonic
`changed` flag: the detector loop set it `true` for an `inferred` write, and the `--set` loop could only
ever flip it `true` again. So when a key had both a live detector _and_ a `--set` that restored the
original config value, the merged `data` ended up equal to the original but `changed` stayed `true` — the
reconcile announced (and could persist) a change that had netted to nothing. `changed` is now computed
once, after all inferred and `--set` writes, as `!deepEqual(data, original)`: a change is reported only if
the final config actually differs from the original. `deepEqual` is exact (order-sensitive), so a
reordering `--set` on a set-semantic key such as `issueKeys` still counts as the change the user asked for.
Distinct from the [R-719](https://linear.app/rheged-studio/issue/R-719) `--set` fix, which corrected the
`had`/`from` report but left `changed` untouched.

**`fleet-update` — default to the canonical skill set
([R-729](https://linear.app/rheged-studio/issue/R-729)).** The single-repo fleet-update pipeline's
`resolveSkills` returned `null` ("omit `--skill`, install everything") when a profile omitted `skills`, so
`skills add <url> --copy` vendored the entire published set — including `scaffold-new-skill`, the
repo-internal scaffolding tool that must never reach consumers. It bit the [R-681](https://linear.app/rheged-studio/issue/R-681) pilot
(release-orchestrator), which picked up `scaffold-new-skill` until the branch was re-vendored with an
explicit list. `resolveSkills` now defaults to the explicit `CANONICAL_SKILLS` set (minus `changelog` for
a `no-changelog` repo), so an omitted `skills` list installs exactly the documented fleet bundles and
never the whole registry. (`fleet-update.mjs` is infra tooling with no bundle version of its own.)
