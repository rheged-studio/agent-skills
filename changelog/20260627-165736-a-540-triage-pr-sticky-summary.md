---
title: Pick one sticky summary per review bot in triage-pr
release_note: The triage-pr review-thread fetcher no longer surfaces every review-bot issue comment as the headline review. It now keeps at most one summary per bot — the bot's first comment, upgraded to a later one bearing a sticky marker (walkthrough / use_sticky_comment / track_progress / "Summary by …") if the first had none — so "I'll review" acks, command acknowledgements, and chatter stop inflating Phase B context.
created_at: '2026-06-27T16:57:36Z'
merged_at: '2026-06-27T17:25:54Z'
branch: a-540-triage-pr-sticky-summary-heuristic-for-aisummarycomments
pr: 62
commit: ca3e325
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-540
stats:
  files_changed: 4
  loc_added: 139
  loc_removed: 10
  commits: 1
version: 1.2.0
---

## Fixed

- **`triage-pr` surfaces one sticky summary per review bot ([R-540](https://linear.app/rheged-studio/issue/R-540)).**
  `buildResult` filtered issue comments by `isBot` alone, so **every** review-bot
  issue comment — "I'll review", walkthrough chatter, command acknowledgements —
  landed in `aiSummaryComments` and was surfaced as "the headline review", inflating
  Phase B context and risking spurious entries in the consolidated acknowledgement.
  A new `selectSummaryComments` heuristic keeps at most one comment per bot: its
  first issue comment, upgraded to a later one carrying a sticky marker
  (`use_sticky_comment` / `track_progress` / walkthrough / "Summary by …") when the
  first had none — so the real summary still wins even when it follows an initial
  "reviewing…" ack. Covered by new `--self-test` fixtures. Bundled as
  `triage-pr@0.4.1`.
