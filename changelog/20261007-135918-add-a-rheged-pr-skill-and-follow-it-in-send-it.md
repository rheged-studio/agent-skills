---
title: add a Rheged pr skill and follow it in send-it
release_note: New `pr` skill writes PR bodies with a Summary visual, a full Changes list, honest Evidence, Merge Danger with the release note, and Related Issues; send-it now follows it.
version: 1.12.0
created_at: "2026-10-07T13:59:18Z"
merged_at: "2026-10-07T15:28:14Z"
branch: a-2429-rheged-pr-skill
pr: 199
commit: c6ca109
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-2429
stats:
  files_changed: 14
  loc_added: 492
  loc_removed: 67
  commits: 11
---

## Added

- **`pr` skill ([A-2429](https://linear.app/rheged-studio/issue/A-2429)).** A new `skills/pr/` bundle (0.1.0) that writes or
  updates a PR body as Summary (the smallest visual that makes the point), Changes
  (every commit, grouped by intent), Evidence (only what was actually run), Merge
  Danger (door, blast radius, and a `**Release:**` line), and Related Issues. A
  `<!-- pr:keep -->` region carries hand-added material such as screenshots
  across every regeneration. It blends Matt Pocock's `pr` skill (MIT) — and,
  through it, Dex Horthy's `show-me` — with send-it's earlier template, and
  credits both in `metadata.credits`.

## Changed

- **send-it 0.11.0.** Step 9 follows the Rheged `pr` skill as a declared
  companion, hands it the release note and Related Issues, carries the keep region
  across when it updates a PR, and falls back to a minimal built-in body when
  `pr` is absent.
- **Estate catalogue.** `pr` moves from the Matt Pocock list to the Rheged list,
  so `--install` replaces Matt's `pr` with the Rheged one; the ship-set docs
  and `fleet-wipe` follow.
