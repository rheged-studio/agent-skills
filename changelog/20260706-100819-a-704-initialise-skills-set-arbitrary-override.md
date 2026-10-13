---
title: 'initialise-skills: --set <key>=<value> arbitrary override'
release_note: 'initialise-skills gains a repeatable --set <skill>.<key>=<value> flag that writes an arbitrary value — one a detector would never produce — into a named skill''s config.json. It rides the normal reconcile (detection still runs; the override wins for the named key), goes through the existing merge/serialise path so key order and formatting are preserved and a re-run is a no-op, and is dry-run first with --write to apply. Values are parsed as JSON (so true / 42 / ["A"] type correctly, falling back to a bare string). It is validated up front: the skill must be installed, the key must exist in that skill''s config.example.json (unknown keys are refused), and the value''s type must match the placeholder''s type. It cannot be combined with the read-only --review.'
created_at: '2026-07-06T10:08:19Z'
merged_at: '2026-07-06T09:40:57Z'
branch: a-704-featinitialise-skills-set-keyvalue-arbitrary-override
pr: 101
commit: 323cc94
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: feature
breaking: false
issues:
  - R-704
stats:
  files_changed: 12
  loc_added: 710
  loc_removed: 9
  commits: 4
version: 1.2.0
---

## Added

**initialise-skills:** a repeatable `--set <skill>.<key>=<value>` flag. Until now
the only override channels were the three stdin fact keys (`linearTeamName`,
`linearWorkspaceSlug`, `issueKeys`) and `acceptDrift` — and `acceptDrift` only
_accepts_ a detected value, it can't push an arbitrary one. Changing any other
setting meant hand-editing `config.json`.

`--set` writes an arbitrary value a detector wouldn't produce into a named skill's
`config.json`. The address is `<skill>.<key>` — the bundle directory name, then a
top-level config key — and the value is parsed as JSON (so `true` / `42` /
`["A"]` type correctly), falling back to a bare string when it isn't valid JSON
(so `develop` stays `"develop"`). It is validated **before any write**: the skill
must be installed, the key must exist in that skill's `config.example.json`
(unknown keys are refused, never silently created), and the coerced value's type
must match that key's example placeholder — so a string can't land in a boolean
field. Any failure exits non-zero and touches nothing.

`--set` rides the normal reconcile — detection still runs and the override is
layered on top, winning over what a detector would infer for the same key — and
goes through the existing merge/serialise path, so key order and formatting are
preserved and a re-run with the same value is a no-op. It is **dry-run first**
(`--write` to apply) and, being a write mode, cannot be combined with the
read-only `--review`. In the report a set key shows as `set to <value> (was
<old>)`.

Implemented as a new pure `scripts/lib/overrides.mjs` (parse / coerce / validate)
plus a `set` parameter threaded through `scripts/lib/merge.mjs`'s `mergeConfig`
(applying overrides after the key loop under a new `set` status that carries the
replaced value as `from`), surfaced by `scripts/lib/report.mjs`. The
`initialise-skills` bundle version is bumped `0.7.0` → `0.8.0`
([R-704](https://linear.app/rheged-studio/issue/R-704)).
