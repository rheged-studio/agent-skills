---
title: 'cleanup-repo: make the Linear Done writeback default configurable'
release_note: cleanup-repo gains a linearWritebackDefault config knob that seeds the Step 10 Linear Done-writeback prompt default ("yes" or "no"). Repos not wired to Linear's GitHub integration can now flip the default to yes without editing the SKILL.md. The interactive gate always stays — the knob only moves the default, it never auto-applies — and an absent key is treated as no, preserving the existing behaviour.
created_at: '2026-07-04T20:20:46Z'
merged_at: '2026-07-04T20:36:59Z'
branch: a-701-cleanup-repo-make-the-linear-done-writeback-default
pr: 98
commit: 55b85d9
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: feature
breaking: false
issues:
  - R-701
stats:
  files_changed: 6
  loc_added: 58
  loc_removed: 8
  commits: 4
version: 1.2.0
---

## Added

**cleanup-repo:** the optional Linear `Done` writeback (Step 10) previously prompted
_"Set them to Done? (yes/no)"_ with a **hardcoded default of no**. That default is
right for repos wired to Linear's GitHub integration — which moves an issue to Done
on PR merge, leaving the writeback for the rare case it didn't fire — but a repo not
using that integration had no way to flip the default short of editing the
`SKILL.md`.

A new `linearWritebackDefault` config knob (`"no"` | `"yes"`) now seeds the Step 10
prompt default. `"yes"` pre-fills the prompt with yes, `"no"` pre-fills no, and an
absent key is treated as `"no"` — so existing consumers are unaffected. The
interactive confirmation always stays; the knob only moves the default and never
silently mass-transitions issues.

The key is added to both the tracked dogfood-config source and
`config.example.json` (their key sets stay identical, as `pnpm validate:skills`
enforces), documented in the SKILL.md and README Configuration tables, and the
`cleanup-repo` bundle version is bumped `0.3.3` → `0.4.0`
([R-701](https://linear.app/rheged-studio/issue/R-701)).
