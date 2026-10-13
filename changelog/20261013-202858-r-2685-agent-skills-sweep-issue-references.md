---
title: sweep Linear issue references to R and C keys
release_note: ""
created_at: "2026-10-13T20:28:58Z"
merged_at: ""
branch: r-2685-agent-skills-sweep-issue-references
pr: ""
commit: ""
author: rob@rheged.studio
co_authors: []
category: chore
breaking: false
issues:
  - R-2685
stats:
  loc_added: 0
  loc_removed: 0
  files_changed: 0
version: ""
---

## Changed

- **Old A-keyed Linear issue references rewritten to the R and C keys ([R-2685](https://linear.app/rheged-studio/issue/R-2685)).** 269 files, 1,344 references, through the committed Linear-migrate mapping. Lowercase branch-style IDs, vendored copies, changelog file names and `branch:` lines are untouched on purpose.
- **Three test expectations keep their A keys.** They pair an uppercase ID with a lowercase `a-` branch twin, so the pair has to stay in step. The `docs/fleet-deployment.md` anchor follows its renamed heading.
