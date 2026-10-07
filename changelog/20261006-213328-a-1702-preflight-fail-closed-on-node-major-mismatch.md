---
title: fail closed when the Node major mismatches the repo pin
release_note: preflight now exits 1 with an nvm/fnm/mise switch hint when the active Node major does not match the repo's .nvmrc or exact engines.node pin, instead of reporting ESLint as a failed linter.
created_at: "2026-10-06T21:33:28Z"
merged_at: "2026-10-07T07:39:52Z"
branch: a-1702-preflight-fail-closed-on-node-major-mismatch
pr: 193
commit: 55599e8
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-1702
stats:
  files_changed: 6
  loc_added: 235
  loc_removed: 6
version:
---

## Added

- **preflight 0.4.0 ([A-1702](https://linear.app/rheged-studio/issue/A-1702)).** Before linting, `preflight.mjs` resolves the
  repo's required Node major — an exact `engines.node` pin (`24.x`, `24.18.0`)
  first, else the `.nvmrc` major — and exits 1 with a switch hint
  (`nvm use` / `fnm use` / `mise use`) when the active Node differs. ESLint never
  runs under the wrong Node, so a version skew no longer surfaces as an
  unparseable `failedLinters` row with `introducedCount: 0`. `>=` / `^` / `~` /
  `||` ranges are not pins; a repo with neither a pin nor an `.nvmrc` is
  unchecked. Ported from the [A-1698](https://linear.app/rheged-studio/issue/A-1698) consumer patch, so the next re-vendor no
  longer wipes it.
- Unit coverage for `parseMajor`, `enginesPinnedMajor` and `requiredNodeMajor`.
