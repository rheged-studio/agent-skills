---
title: "Port the deferred eslint-config release hardening"
release_note: "Lands the build-once 3-job release split, the load-repo-config action, the dated-changelog system, and husky hooks — dormant whilst private."
version: "0.0.1"
created_at: "2026-06-01T14:37:56Z"
merged_at: "2026-06-01T15:04:14Z"
branch: "asw-345-port-deferred-eslint-config-release-hardening-build-once"
pr: 15
commit: "ff919aa"
merge_strategy: squash
author: "rob@acmeskunkworks.io"
co_authors: []
category: chore
breaking: false
issues: ["R-345"]
stats:
  files_changed: 34
  loc_added: 3656
  loc_removed: 329
  commits: 5
---

## Added

- A build-once-publish-exact 3-job `release.yml`: an unprivileged `build` job packs one tarball, and `release` (npm OIDC) + `publish-github-packages` (provenance attestation) each publish that exact artifact, so no build-time code runs alongside a publish credential.
- The `load-repo-config` composite action over an allowlist-validated `infrastructure/repo-config.yaml` (node-version-file, registry URLs, npm scope).
- The dated-changelog system (`changelog/<ts>-<slug>.md` entries + `finalise` / `enrich` / `stamp` / `add-links` / `validate` helpers, wired into `changeset:version` and `/send-it` Step 5b).
- Husky hooks (`pre-push` blocks direct `main` pushes, `commit-msg` strips the Claude trailer, `pre-commit` runs lint-staged).

## Changed

- Scoped the npm tarball to the skill bundles via `files: ["skills/"]`.

The machinery is fully wired and exercised in CI but stays dormant whilst `private: true` — it publishes nothing until the flip-to-public.
