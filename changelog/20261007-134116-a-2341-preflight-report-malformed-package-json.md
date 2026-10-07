---
title: report a malformed package.json clearly in preflight
release_note: preflight now reports an invalid or non-object package.json with a clear message instead of crashing with a stack trace.
created_at: "2026-10-07T13:41:16Z"
merged_at:
branch: a-2341-preflight-report-malformed-package-json
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: fix
breaking: false
issues:
  - A-2341
stats:
  files_changed:
  loc_added:
  loc_removed:
---

## Fixed

- **preflight 0.4.1 ([A-2341](https://linear.app/rheged-studio/issue/A-2341)).** The Node-major gate parsed the repo's
  `package.json` with no guard, so invalid JSON or a top-level `null`
  escaped as an uncaught stack trace. preflight now prints
  `preflight: <path> contains invalid JSON` or
  `preflight: <path> must contain a JSON object` and exits 1. A malformed
  manifest is still treated as an error, never as "no Node pin".
