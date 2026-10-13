---
title: resolve each issue's own team in the Linear skills
release_note: linear-sync, cleanup-repo, send-it and triage-pr now resolve Linear states against each issue's own team and read only a branch's leading issue ID, so one repo can carry issues from several teams.
created_at: "2026-10-13T09:20:06Z"
merged_at: "2026-10-13T10:33:48Z"
branch: a-2682-resolve-each-issues-team
pr: 207
commit: 8a59c38
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-2682
  - A-2683
stats:
  files_changed: 30
  loc_added: 927
  loc_removed: 164
  commits: 10
version: 1.13.0
---

## Added

- **Multi-team reference helpers ([A-2682](https://linear.app/rheged-studio/issue/A-2682)).** `lib/issue-keys.mjs` gains
  `extractBranchIssueId` / `buildBranchIssueRe`, which read only a branch's
  leading `<KEY>-<n>` token. The new `lib/linear-states.mjs` pins per-team state
  resolution, the per-team status cache and the forward-only transition rule.
  Tests model one repo carrying `c-`, `r-` and legacy `a-` branches.

## Changed

- **Linear-sync 0.4.0 and cleanup-repo 0.5.0 ([A-2682](https://linear.app/rheged-studio/issue/A-2682)).** Workflow states are
  resolved against the team `get_issue` returns for each issue, once per team,
  instead of once for `linearTeamName`. `linearTeamName` is now the fallback for
  an issue with no team. Only the branch's leading issue ID counts, so slug
  tokens such as `-c-2-` no longer transition an unrelated issue. cleanup-repo
  now spots open issues by state type rather than the name `Done`.
- **triage-pr 0.19.0 ([A-2682](https://linear.app/rheged-studio/issue/A-2682)).** A follow-up with a parent is created in the
  parent's team, with its state resolved for that team. Flat follow-ups still use
  `linearTeamName` and `followUpProject`.
- **send-it 0.12.1 and changelog 0.10.0 ([A-2682](https://linear.app/rheged-studio/issue/A-2682)).** send-it's Step 10 and the
  changelog `issues` field follow the same rules: the branch's leading ID, plus
  IDs found anywhere in commit messages.
- **Issue keys `R` and `A` ([A-2683](https://linear.app/rheged-studio/issue/A-2683)).** This repo's Linear-sync, cleanup-repo,
  triage-pr and changelog configs now use `issueKeys: ["R", "A"]`, ready for
  the Linear key flip.

## Fixed

- **rheged-skills-setup 0.15.2 ([A-2683](https://linear.app/rheged-studio/issue/A-2683)).** The skill-config `.gitignore` strip
  also recognises comments citing `R-640` / `R-812`, so consumer comments still
  match after the reference sweep. The detectable-keys reference now says
  `issueKeys` detection finds one key, so multi-team repos need `--set`.
