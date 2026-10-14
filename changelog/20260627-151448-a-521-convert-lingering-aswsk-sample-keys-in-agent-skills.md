---
title: Correct the Linear workspace slug and retire stale ASW/SK test fixtures
release_note: The changelog skill now generates Linear links against the correct acme-skunkworks workspace instead of the unrelated goose-and-hobbes one, so enriched changelog entries point at real issues. Alongside this, lingering ASW/SK sample keys in the test fixtures are converted to the current A- team key and to neutral placeholders, completing the SK-to-A rename in agent-skills.
created_at: '2026-06-27T15:14:48Z'
merged_at: '2026-06-27T15:40:09Z'
branch: a-521-convert-lingering-aswsk-sample-keys-in-agent-skills-test
pr: 53
commit: cfef6c9
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-521
stats:
  files_changed: 14
  loc_added: 86
  loc_removed: 41
  commits: 6
version: 1.2.0
---

## Fixed

- **Linear workspace slug corrected to `acme-skunkworks` ([R-521](https://linear.app/rheged-studio/issue/R-521)).** The
  `changelog` bundle's `config.json` carried `linearWorkspaceSlug:
  goose-and-hobbes` — a different (climbwell's) workspace — so `add-links.mjs`
  generated changelog links pointing at the wrong workspace. It now reads
  `acme-skunkworks`, matching the canonical issue URLs. The authoritative
  statements of the slug in `CLAUDE.md` and the `initialise-skills` command, plus
  a stale `README.md` issue link, are corrected to match.

## Changed

- **Retired the lingering `ASW`/`SK` sample keys in the test fixtures ([R-521](https://linear.app/rheged-studio/issue/R-521)).**
  Generic parser/merge fixtures that still used the retired `ASW`/`SK` team keys
  now use the current `A` key, or — where a case deliberately exercises
  multi-element, order-insensitive set equality — neutral placeholders
  (`ABC`/`XYZ`, with a distinct second pair where a detector value must differ
  from the example). This completes the `SK → A` rename closeout in agent-skills;
  no production allowlist was affected (those were already `["A"]`).
