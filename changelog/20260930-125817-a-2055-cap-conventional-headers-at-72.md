---
title: Cap send-it and commit Conventional headers at 72 characters
release_note: /commit and /send-it now keep Conventional Commits headers — the entire first line — at or under 72 characters, so agents already emit short subjects before estate commitlint tightens from 100 to 72.
created_at: "2026-09-30T12:58:17Z"
merged_at:
branch: a-2055-cap-conventional-headers-at-72
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-2055
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
version:
---

## Changed

- **commit (0.1.3 → 0.2.0).** A Conventional Commits **header** (the whole first
  line: `type`, optional scope, optional `!`, colon and space, then the subject)
  must be **≤ 72 characters**. If a natural header would overflow, rewrite it;
  do not wrap onto a second line to dodge the cap. Body wrapping is out of
  scope ([A-1413](https://linear.app/rheged-studio/issue/A-1413)).
- **send-it (0.8.2 → 0.9.0).** The same cap applies to derived PR titles,
  delegated `/commit` subjects, and send-it's own `git commit -m` lines. `--title`
  stays verbatim but warns when it exceeds 72 characters.
