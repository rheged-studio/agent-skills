---
title: Split triage-pr docs and de-duplicate review rules
release_note: ""
created_at: "2026-10-06T18:51:08Z"
merged_at: "2026-10-06T19:19:27Z"
branch: a-2325-triage-pr-split-skillmd-and-de-duplicate-it-against-review
pr: 190
commit: 81aedca
author: rob@rheged.studio
co_authors: []
category: docs
breaking: false
issues:
  - A-2325
stats:
  files_changed: 11
  loc_added: 497
  loc_removed: 505
  commits: 4
version: 1.10.0
---

## Changed

- **triage-pr (0.15.0 → 0.16.0).** Split Phase B into reference files
  (`phase-b-envelope`, `phase-b-unattended`, `follow-up-routing`); slim
  `SKILL.md` to a spine with pointers so impact rubric, lint surfaces, and
  routing each have one home ([A-2325](https://linear.app/rheged-studio/issue/A-2325)).
- **send-it (0.9.1 → 0.9.2).** Trim Step 11 so it delegates to triage-pr instead
  of restating Phase B behaviour.
