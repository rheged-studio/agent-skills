---
title: file triage-pr follow-ups as sub-issues of the PR's issue
release_note: triage-pr now files each follow-up as a sub-issue of the Linear issue the PR was raised under, and uses the catch-all project only when the PR has no linked issue.
created_at: "2026-10-12T21:33:04Z"
merged_at: "2026-10-13T08:14:45Z"
branch: a-2756-triage-pr-follow-ups-as-sub-issues
pr: 205
commit: b38a69f
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-2756
stats:
  files_changed: 9
  loc_added: 102
  loc_removed: 73
  commits: 5
version: 1.13.0
---

## Changed

- **triage-pr follow-up routing ([A-2756](https://linear.app/rheged-studio/issue/A-2756)).** A follow-up is now filed as a
  sub-issue (`parentId`) of the Linear issue the PR was raised under. It takes
  that issue's project and milestone as they are. When the PR has no linked
  issue, or the lookup misses, it goes to the `followUpProject` catch-all with
  no milestone. The `followUpLabel` requirement and the fail-closed rules on
  project and label are unchanged.
- **Removed cascade.** The `relatedTo` link is gone, and so is everything it
  needed: the live-project check (completed or canceled projects), the
  milestone lookup, and the per-repo milestone on the catch-all that was
  created with `save_milestone` at mint time. `list_milestones` and
  `save_milestone` leave the skill's allowed tools. Plan lines now read
  `file as sub-issue of A-NNNN (<project>)` or
  `file under <catch-all> (no linked issue)`. triage-pr moves to 0.18.0.
- **Docs.** `followUpProject` keeps its name and estate value
  (`Follow-up issues`), so consumer configs need no change. Its descriptions in
  rheged-skills-setup (0.15.1) and the fleet runbook now say it is the
  catch-all for PRs with no linked issue.
