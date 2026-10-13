---
title: Capture out-of-scope triage-pr review suggestions as human-approved Linear issues
release_note: triage-pr can now turn a valid-but-out-of-scope review finding into a tracked Linear follow-up issue. Phase B gains a fourth 'defer' thread outcome, and a post-convergence step proposes all flagged candidates in one batch — creating issues only on explicit human approval (default no), then writing each issue id/URL back into the defer reply and the consolidated summary. Five new config keys gate the opt-in flow, and initialise-skills reconciles them.
version: 1.2.0
created_at: '2026-06-29T16:15:49Z'
merged_at: '2026-06-29T16:35:39Z'
branch: a-567-feattriage-pr-capture-out-of-scope-review-suggestions-as
pr: 73
commit: a75c764
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-567
stats:
  files_changed: 13
  loc_added: 304
  loc_removed: 37
  commits: 5
---

## Added

- **Defer out-of-scope findings into tracked Linear issues ([R-567](https://linear.app/rheged-studio/issue/R-567)).**
  `triage-pr` Phase B can now flag any valid-but-out-of-scope review finding — per-thread
  **or** issue-level — as a follow-up candidate. After the thread loop converges, a new capture
  step (SKILL.md Step 10) surfaces every candidate as a single batch and, **only on explicit
  human approval** (default no, mirroring `cleanup-repo`'s two-pass gate), creates one Linear
  issue per approved candidate via `mcp__linear-server__save_issue` — each carrying the bot's
  rationale, a back-link to the PR and the specific thread/comment, and the originating
  `path:line`. Nothing is created without approval, and merge to `main` stays a human action.

- **A fourth `defer` thread outcome in `respond-threads.mjs`.** Alongside accept / decline /
  outdated, `--decision defer --reference <ticket>` posts a factual reply
  (`Out of scope for this PR; tracked as <ticket> for follow-up.`) and resolves the thread.
  The created issue's id/URL is written back into both the defer reply and the Step 10
  consolidated summary's `<ticket>` slot. Covered by the bundle `--self-test` and the root
  vitest suite.

- **Five new opt-in config keys** (`linearTeamName`, `issueKeys`, `followUpLabel`,
  `followUpProject`, `followUpState`) in both `config.json` and `config.example.json`, with
  identical key sets. Capture is disabled (and the step skipped silently) when `linearTeamName`
  is empty or the Linear MCP server is unavailable. `initialise-skills` registers all five for
  automatic reconciliation, and `triage-pr` joins the shared `linearTeamName` / `issueKeys`
  detectors.

## Changed

- **`triage-pr` `allowed-tools`** gains `mcp__linear-server__save_issue`,
  `list_issue_statuses`, and `list_projects` (the latter two resolve a configured state by
  type / project by name and fail loudly on a typo). Both bundle versions bump in lockstep:
  `triage-pr` and `initialise-skills` to `0.5.0`.
