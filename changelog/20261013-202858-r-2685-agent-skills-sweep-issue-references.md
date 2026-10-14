---
title: sweep Linear issue references to R and C keys
release_note: ""
created_at: "2026-10-13T20:28:58Z"
merged_at: "2026-10-14T08:05:50Z"
branch: r-2685-agent-skills-sweep-issue-references
pr: 212
commit: 4c05d43
author: rob@rheged.studio
co_authors: []
category: chore
breaking: false
issues:
  - R-2685
stats:
  loc_added: 1007
  loc_removed: 981
  files_changed: 281
  commits: 4
version: 1.13.1
---

## Changed

- **Old A-keyed Linear issue references rewritten to the R and C keys ([R-2685](https://linear.app/rheged-studio/issue/R-2685)).** 269 files, 1,344 references, through the committed Linear-migrate mapping. Lowercase branch-style IDs, vendored copies, changelog file names and `branch:` lines are untouched on purpose.
- **Three test expectations keep their A keys.** They pair an uppercase ID with a lowercase `a-` branch twin, so the pair has to stay in step. The `docs/fleet-deployment.md` anchor follows its renamed heading.
- **Eleven skill bundles patch-bumped.** changelog 0.10.1, cleanup-repo 0.5.1, commit 0.3.1, Linear-sync 0.4.1, pr 0.1.1, preflight 0.5.1, release-status 0.2.3, rheged-skills-setup 0.15.3, scaffold-new-skill 0.1.2, send-it 0.12.2 and triage-pr 0.19.1. Each `package.json` version and `SKILL.md` `metadata.version` move together.
