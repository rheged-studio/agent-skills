---
title: make unattended Phase B the default in agent-skills
release_note: triage-pr now defaults to unattended Phase B (plan on the PR, no Yes/No or Linear prompt), with follow-up destination cascade, head-commit settle, and send-it hand-off when humanEnvelope is false; rheged-skills-setup stops wiping follow-up labels and drops cursor from review bots; changelog quotes SHA-like frontmatter values so they stay strings.
created_at: "2026-10-06T19:15:00Z"
branch: a-2015-make-unattended-phase-b-the-default-in-agent-skills
category: feature
breaking: false
issues:
  - A-2015
merged_at: "2026-10-06T18:31:10Z"
commit: 14f8e37
pr: 189
stats:
  loc_added: 1755
  loc_removed: 443
  files_changed: 28
  commits: 5
version: 1.10.0
---

## Added

- **Unattended Phase B as the estate default ([A-2015](https://linear.app/rheged-studio/issue/A-2015)).**
  Port the Tempest trial into the agent-skills source: disposition-plan upsert,
  destination cascade (`followUpLabel` required when capture is on), head-commit
  review settle, and `maxReviewRounds`. `humanEnvelope` defaults to `false`; set
  `true` to restore the Yes/No envelope.

- **send-it 0.9.1 hand-off.** Phase B ends on triage-pr Step 13 when unattended,
  or on the human envelope when `humanEnvelope` is `true`.

## Changed

- **rheged-skills-setup 0.12.1.** Detector defaults `followUpLabel` to
  `follow-up`, `humanEnvelope` to `false`, `reviewIdleMinutes` to `10`; reconcile
  strips deprecated `cursor` from `reviewBots`.

- **changelog 0.9.7.** Quote YAML scientific-notation commit SHAs on emit
  ([A-2329](https://linear.app/rheged-studio/issue/A-2329)).

## Skill bundle versions

- `triage-pr` 0.15.0
- `send-it` 0.9.1
- `rheged-skills-setup` 0.12.1
- `changelog` 0.9.7
