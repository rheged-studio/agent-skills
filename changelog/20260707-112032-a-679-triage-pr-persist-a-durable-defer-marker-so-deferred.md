---
title: Persist a durable defer marker in triage-pr so deferred threads aren't reprocessed
release_note: triage-pr now marks a deferred review thread durably the moment it's set aside for follow-up, so it is no longer re-triaged as a fresh finding on every subsequent review pass and a fresh invocation can still finish minting its ticket.
created_at: '2026-07-07T11:20:32Z'
merged_at: '2026-07-07T11:48:18Z'
branch: a-679-triage-pr-persist-a-durable-defer-marker-so-deferred-threads
pr: 112
commit: 93924ce
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-679
stats:
  loc_added: 428
  loc_removed: 45
  files_changed: 7
  commits: 4
version: 1.2.1
---

## Fixed

**`triage-pr` (0.5.2 → 0.6.0) — a deferred review thread now carries a durable
marker between Step 8 and Step 10
([R-679](https://linear.app/rheged-studio/issue/R-679)).** A review thread judged
valid-but-out-of-scope was recorded as an in-memory follow-up candidate at Step 8
and only resolved at Step 10 (once its ticket was minted), left unresolved **and**
unreplied in between with no durable marker. Because all triage-pr state is
GitHub-side, each push re-triggered review and `review-threads.mjs` re-emitted the
still-open thread as a fresh finding — the same candidate re-triaged every pass, up
to `maxCiRounds` — and a fresh invocation that started mid-loop, holding no
in-memory candidate list, never reached Step 10 for those threads. Step 9's
convergence clause claimed an idempotency marker prevented this, but that marker is
only written when a reply is posted, which does not happen for a defer until
Step 10.

`respond-threads.mjs` gains a `defer-pending` decision — a new non-resolving
`reply-only` action that posts a distinct hidden `defer-pending` marker without
resolving, idempotent against its own marker so recording the same candidate twice
never double-posts. `review-threads.mjs` reads that marker and routes such threads
into a new `deferredThreads` bucket, so they are no longer re-emitted as fresh
findings and stay rediscoverable by a later invocation. Step 10 now gathers
candidates from the union of the in-memory list and that bucket (deduplicated by
`threadId`), then posts the final resolving defer (or decline) reply, superseding
the pending marker. SKILL.md Steps 7–10 and the convergence narrative are updated to
match, with coverage in the vitest suites and both scripts' offline self-tests.
