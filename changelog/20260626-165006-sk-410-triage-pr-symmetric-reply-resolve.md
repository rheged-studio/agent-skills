---
title: Make triage-pr's review-reception symmetric with an issue-level acknowledgement path
release_note: The triage-pr skill now acknowledges accepted review findings as deliberately as it declines them — an accepted thread gets a factual reply referencing the fixing commit before it is resolved (once that fix is CI-green), gated by a new replyOnAccept config knob (default true). Issue-level review comments that have no resolvable thread (Claude's whole-review comment, CodeRabbit's sticky summary) are acknowledged in one consolidated, upserted PR comment. A new bundled respond-threads.mjs script encodes the symmetry, replyOnAccept, idempotency marker and consolidated-comment logic, and re-runs converge without double-posting.
created_at: '2026-06-26T16:50:06Z'
merged_at: '2026-06-26T17:30:38Z'
branch: sk-410-harden-triage-pr-symmetric-reply-resolve-for-accepted
pr: 43
commit: 8292ee8
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-410
affected_packages:
  - triage-pr
stats:
  files_changed: 8
  loc_added: 1301
  loc_removed: 23
  commits: 5
version: 1.2.0
---

## Added

- **`respond-threads.mjs` — the write side of Phase B.** A new zero-dependency
  bundled script under `skills/triage-pr/scripts/`. Its pure core
  (`planThreadResponses`, `buildReplyBody`, `buildConsolidatedComment`,
  `findExistingAckComment`, `hasMarker`) encodes the symmetric reply/resolve rules,
  the `replyOnAccept` knob, and the idempotency markers; thin `gh` subcommands
  (`thread`, `summary`) run the GraphQL/REST mutations. Covered by a built-in
  `--self-test` and a new `tests/skills/triage-pr/respond-threads.test.ts` vitest
  suite — verifiable without posting to a real PR.
- **`replyOnAccept` config knob** (default `true`) in `config.json` /
  `config.example.json`, so maintainers who dislike bot-reply noise can resolve
  accepted threads silently whilst declines always reply with reasoning.
- **Consolidated issue-level acknowledgement.** Findings that arrive as issue-level
  comments (Claude's review, CodeRabbit's sticky summary) — which have no resolvable
  per-finding thread — are now mapped into a single upserted PR comment
  (accepted `<sha>` / declined `<reason>` / out-of-scope `<ticket>`).

## Changed

- **RESPOND is now symmetric (SKILL.md Step 8).** An accepted finding gets a factual
  reply referencing the fixing commit and is then resolved — no longer resolved
  silently — mirroring the existing decline path. Accepted threads resolve only once
  the fix's CI round is green; declines and outdated threads resolve immediately.
- **Convergence + idempotency documented (Step 9).** Each reply/comment carries a
  hidden marker so a re-run skips already-handled threads and edits the consolidated
  comment in place, terminating the Phase A ↔ B loop within `maxCiRounds` without
  double-posting. The human-thread guardrail is preserved — only configured
  `reviewBots` are ever auto-actioned.
- **Recorded the canonical CodeRabbit resolve mechanism** in
  `references/review-discipline.md`: per-thread GraphQL `resolveReviewThread` paired
  with an explicit reply, never the bulk `@coderabbitai resolve`.
