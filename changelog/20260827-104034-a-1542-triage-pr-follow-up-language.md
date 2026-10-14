---
title: triage-pr follow-up language (rename defer)
release_note: triage-pr Phase B now talks about follow-up issues instead of deferring — envelope plan, thread replies, and CLI decisions use follow-up / follow-up-pending (legacy defer aliases still accepted; in-flight defer-pending markers still bucket correctly).
created_at: "2026-08-27T10:40:34Z"
branch: a-1542-rename-triage-pr-defer-language-to-follow-up-and-review
category: feature
breaking: false
issues:
  - R-1542
merged_at: "2026-08-27T11:02:03Z"
commit: c179186
pr: 172
stats:
  loc_added: 344
  loc_removed: 176
  files_changed: 10
  commits: 4
version: 1.5.0
---

## Changed

- **Follow-up language across Phase B ([R-1542](https://linear.app/rheged-studio/issue/R-1542)).**
  Human-facing copy (envelope plan, Step 13 report, GitHub thread replies) now
  describes filing a **follow-up issue**, not deferring work. Disposition label
  `follow-up` replaces `defer`; `follow-up-pending` replaces `defer-pending`.
  Decline fallback text is `Follow-up not tracked`. `accept`, `decline`, and
  `gated` are unchanged; `deferNonBlocking` config key is unchanged (descriptions
  only).

- **`respond-threads.mjs` decision aliases and reply templates.**
  Preferred CLI values `follow-up` / `follow-up-pending`; legacy `defer` /
  `defer-pending` still accepted via `normalizeDecision()`. New posts emit
  `<!-- triage-pr:follow-up-pending -->`; readers accept the legacy
  `defer-pending` marker too. Consolidated summary table label `Deferred` →
  `Follow-up`.

- **`review-threads.mjs` dual-marker bucket.** `deferredThreads` JSON key
  unchanged; both pending markers route into that bucket.

- **send-it cross-references** aligned to follow-up-pending wording.

- **triage-pr `0.11.1` → `0.12.0`.**
