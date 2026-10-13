---
title: "Wire up dormant dual-registry npm + GitHub Packages publishing"
release_note: "Ports the dual-registry publishing machinery from eslint-config, kept dormant whilst the package is private."
version: "0.0.1"
created_at: "2026-05-29T10:04:13Z"
merged_at: "2026-05-29T10:44:25Z"
branch: "asw-306-wire-up-npm-github-packages-publishing-dormant-while-root"
pr: 8
commit: "fc7400e"
merge_strategy: merge
author: "rob@acmeskunkworks.io"
co_authors: []
category: chore
breaking: false
issues: ["R-306"]
stats:
  files_changed: 6
  loc_added: 226
  loc_removed: 12
  commits: 4
---

## Added

- OIDC Trusted Publishing to npm (`scripts/publish-via-raw-npm.sh`, with `--provenance`) plus a GitHub Packages leg (`scripts/publish-to-github-packages.sh`), wired into `release.yml` and ported from `@acme-skunkworks/eslint-config`.
- `publishConfig` (`access: public`, `provenance: true`) in `package.json`.

## Changed

- Rewrote the `CLAUDE.md` Release section to document the dual-registry, dormant-by-design flow and a mechanical flip-to-public checklist. The pipeline stays dormant whilst `private: true` — it runs green and publishes nothing.
