---
title: Bump shared @acme-skunkworks configs and fix markdownlint fallout
release_note: ""
created_at: "2026-08-07T15:14:03Z"
merged_at: "2026-08-11T13:03:53Z"
branch: a-1341-agent-skills-bump-acme-skunkworks-devdeps-and-fix-lint
pr: 161
commit: 640ce99
author: rob@acmeskunkworks.io
co_authors: []
category: chore
breaking: false
issues:
  - R-1341
stats:
  files_changed: 59
  loc_added: 186
  loc_removed: 146
  commits: 3
version: 1.4.1
---

## Changed

- **Shared `@acme-skunkworks/*` devDeps brought to published latest ([R-1341](https://linear.app/rheged-studio/issue/R-1341)).**
  `markdownlint-config` ^3.0.0, `eslint-config` ^1.1.3, `changelog-core` ^1.1.1,
  and `commitlint-config` ^1.0.1. The agent-skills package version itself is
  unchanged (already at 1.4.0).

- **markdownlint 3.0.0 fallout cleared.** Underscore italics (MD049), proper-name
  casing for Linear (MD044), fenced-code languages (MD040), and command-shim
  frontmatter titles (MD041) updated across docs, historical changelog entries,
  and skill prose. Touched skill bundles patch-bumped so their published
  metadata stays in lockstep with the content edits.
