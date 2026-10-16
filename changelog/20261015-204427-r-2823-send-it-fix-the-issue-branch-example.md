---
title: fix the send-it --issue branch example
release_note: The send-it docs now show --issue=R-7 producing an r-7- branch, not a-7-.
created_at: "2026-10-15T20:44:27Z"
merged_at: "2026-10-16T08:16:41Z"
branch: r-2823-send-it-fix-the-issue-example-that-lower-cases-r-7-to-a-7
pr: 216
commit: 0ab29af
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - R-2823
stats:
  loc_added: 30
  loc_removed: 6
  files_changed: 5
  commits: 4
version: 1.13.2
---

## Fixed

- **The `--issue` branch examples in send-it now lower-case `R-7` to `r-7-` ([R-2823](https://linear.app/rheged-studio/issue/R-2823)).** The flag reference said `--issue=R-7` gives `a-7-<slug>`, which contradicted the lower-casing rule it was meant to show. It was left over from the A → R team-key rename. The Step 1 example `a-7-as-acquired` is now `r-7-as-acquired` to match, and so is the repo's own `/send-it` shim, which still said `asw-7-<slug>`.

## Changed

- **send-it patch-bumped to 0.12.3.**
