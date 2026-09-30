---
title: Qualify send-it README 72-char cap for --title
release_note: The send-it README now qualifies the 72-character PR-title cap so it applies to derived titles; a supplied `--title` stays verbatim and warns if overlong.
created_at: "2026-09-30T13:30:19Z"
merged_at:
branch: a-2057-qualify-send-it-readme-72-char-cap-for-title
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: docs
breaking: false
issues:
  - A-2057
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
version:
---

## Changed

- **send-it (0.9.0 → 0.9.1).** The README now qualifies the 72-character PR-title
  cap: it applies to derived titles. A supplied `--title` stays verbatim and
  warns if overlong, matching `SKILL.md` ([A-2057](https://linear.app/rheged-studio/issue/A-2057)).
