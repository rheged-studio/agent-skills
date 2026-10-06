---
title: refresh the estate catalogue for mattpocock/skills 1.3.1 and ask for the Claude token at org or repo level
release_note: The estate catalogue tracks mattpocock/skills 1.3.1 (adds implement-spec, pr and retro; drops resolving-merge-conflicts), send-it writes PR bodies in the pr skill's shape when it is installed, and rheged-skills-setup asks for CLAUDE_CODE_OAUTH_TOKEN at org or repo level in its confirmation gate.
created_at: "2026-10-06T21:38:12Z"
merged_at:
branch: a-2298-refresh-estate-catalogue-for-mattpocockskills-v131
pr:
commit:
author: "rob@rheged.studio"
co_authors: []
category: feature
breaking: false
issues:
  - A-2298
  - A-1621
stats:
  files_changed:
  loc_added:
  loc_removed:
version:
---

## Added

- **Catalogue ([A-2298](https://linear.app/rheged-studio/issue/A-2298)).** The `matt-pocock` source in
  `infrastructure/skill-catalogue.json` now lists `implement-spec`, `pr` and
  `retro`, so it matches upstream's Engineering and Productivity buckets at
  1.3.1. Upstream's `misc` and `in-progress` buckets stay out, and that choice is
  recorded in `docs/fleet-deployment.md`.
- **send-it 0.10.0 ([A-2298](https://linear.app/rheged-studio/issue/A-2298)).** When Matt Pocock's `pr` skill is installed,
  Step 9 writes the PR body in its shape (Summary visual, Evidence, Merge
  Danger). send-it still adds its own `## Related Issues` section and the
  no-release note. The built-in template remains the fallback.

## Changed

- **rheged-skills-setup 0.13.0 ([A-1621](https://linear.app/rheged-studio/issue/A-1621)).** The `CLAUDE_CODE_OAUTH_TOKEN` probe
  runs before the confirmation gate, applies only when estate Claude callers are
  present, and also lists org secrets when it can. When the secret is absent, the
  gate asks for it at org or repo level (`claude setup-token`, then
  `gh secret set … --org` or `--repo`) and explains the `visibility: selected`
  caveat. It no longer points to `/install-github-app` for the secret.
- **Runbook ([A-2298](https://linear.app/rheged-studio/issue/A-2298)).** `docs/fleet-deployment.md` records the catalogue
  decisions. It also adds the per-repo `CONTEXT.md` → `GLOSSARY.md` rename step
  for the next re-vendor, and notes that `humanEnvelope` is already upstream
  ([A-2015](https://linear.app/rheged-studio/issue/A-2015)).

## Fixed

- **`resolving-merge-conflicts` dropped ([A-2298](https://linear.app/rheged-studio/issue/A-2298)).** Upstream removed it in 1.3.0,
  so `--install` and `fleet-update` would have failed the Matt-bundle presence
  check. It is now in `LEGACY_BUNDLE_NAMES`, so stale vendored copies are wiped
  on the next install.
