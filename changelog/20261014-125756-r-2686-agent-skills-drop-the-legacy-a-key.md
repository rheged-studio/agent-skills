---
title: drop the legacy A issue key
release_note: "The legacy A issue key is no longer accepted in the repo's own skill configs, and the skill docs now show R-only examples."
created_at: "2026-10-14T12:57:56Z"
merged_at: ""
branch: r-2686-agent-skills-drop-the-legacy-a-key
pr:
commit: ""
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - R-2686
stats:
  loc_added:
  loc_removed:
  files_changed:
version: ""
---

## Fixed

- **`issueKeys` is `["R"]` in the root and dogfood configs ([R-2686](https://linear.app/rheged-studio/issue/R-2686)).** Linear renamed the A team key to R on 2026-10-13 and no `a-` branches or PRs remain open, so the legacy key is dropped from `config.json` and `infrastructure/dogfood-config/*.json`.

## Changed

- **Skill docs no longer recommend keeping the legacy key.** The `issueKeys` examples and the renamed-team notes in changelog, cleanup-repo, Linear-sync, triage-pr, rheged-skills-setup and `docs/fleet-deployment.md` now use R-only values.
- **Five skill bundles patch-bumped.** changelog 0.10.2, cleanup-repo 0.5.2, Linear-sync 0.4.2, triage-pr 0.19.2 and rheged-skills-setup 0.15.4.
- **Releasable on purpose.** The final fleet re-vendor needs a tag that includes the earlier sweep PR #212.
