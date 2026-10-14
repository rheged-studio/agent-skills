---
title: Add a /commit command backed by a shared commit-grouping skill
release_note: Adds a standalone /commit command that turns the working tree into logical, atomic Conventional Commits with an out-of-scope guard — no push, PR, changelog, or Linear writeback. The commit-grouping contract is now a shared skill that /send-it delegates its commit step to.
created_at: '2026-07-04T17:23:42Z'
merged_at: '2026-07-04T18:13:38Z'
branch: a-350-add-a-commit-command-backed-by-a-shared-commit-grouping
pr: 95
commit: 96ae57f
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: feature
breaking: false
issues:
  - R-350
stats:
  files_changed: 11
  loc_added: 328
  loc_removed: 50
  commits: 6
version: 1.2.0
---

## Added

**commit:** a new standalone [`commit`](../skills/commit/SKILL.md) skill and a
`/commit` command. It turns the working tree into logical, atomic Conventional
Commits: it classifies uncommitted files as in-scope vs out-of-scope against the
branch's merge base (`git merge-base HEAD origin/<base>`), shows a staging plan,
and **never** `git add -A`s — stray files from another branch or worktree are
flagged and never staged silently. In-scope files are grouped one commit per
coherent unit (type + optional scope + British-English body; `!` /
`BREAKING CHANGE:` for breaking changes). It commits only — no push, PR,
changelog, or Linear writeback. Contract-only skill: the grouping is model-driven
and the `SKILL.md` prose is the source of truth ([R-350](https://linear.app/rheged-studio/issue/R-350)).

## Changed

**send-it:** Step 3 now delegates to the `commit` skill instead of carrying its own
commit-grouping prose — the standalone `/commit` command supplies the second
consumer that justifies centralising the contract. The bundle is bumped to `0.6.0`
and now names `commit` among its required delegated siblings ([R-350](https://linear.app/rheged-studio/issue/R-350)).

Per-component atomic-commit splitting stays **parked** ([R-374](https://linear.app/rheged-studio/issue/R-374)):
`/commit` groups by intent, not component or package boundaries.
