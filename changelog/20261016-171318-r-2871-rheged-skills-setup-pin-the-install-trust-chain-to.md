---
title: pin the rheged-skills-setup --install trust chain
release_note: rheged-skills-setup --install now runs a pinned skills CLI, reads its catalogue from the bundle, installs every source at a pinned ref, and installs the Matt Pocock packs only with --include-third-party.
created_at: "2026-10-16T17:13:18Z"
merged_at:
branch: r-2871-rheged-skills-setup-pin-the-install-trust-chain-to-clear
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - R-2871
stats:
  files_changed:
  loc_added:
  loc_removed:
version:
---

## Added

- **`--include-third-party` opt-in for `rheged-skills-setup --install` ([R-2871](https://linear.app/rheged-studio/issue/R-2871)).** Catalogue sources gain a `thirdParty` flag, and `mattpocock/skills` carries it. A default `--install` now vendors only first-party sources. The dry-run lists third-party sources separately as skipped, and the pre-install wipe leaves their bundles alone.
- **`## Scope and safeguards` and `## Untrusted input` sections in the `rheged-skills-setup` SKILL.md.** They state that reconcile mode is local-only, that `--install` is the only networked path, and how host-repo files and the catalogue are treated as data.

## Changed

- **`--install` pins its whole trust chain.** It runs `npx --yes skills@1.7.2`, held in one `SKILLS_CLI_VERSION` constant, instead of whatever `latest` resolves to. It reads the catalogue from a copy vendored in the bundle (`assets/skill-catalogue.json`) instead of fetching it from `main`. Each catalogue source now carries a pinned `ref`, passed to the CLI as a `/tree/<ref>` URL: the `v1.13.2` release tag for the Rheged source and a full commit SHA for `mattpocock/skills`. The catalogue parser refuses a source with no ref or a branch-name ref.
- **The `.claude/skills.lock` `ref` defaults to the pinned Rheged ref, not `main`.**
- **`validate-catalogue.mjs` checks the pins.** It requires `thirdParty: true` and a commit SHA on any source outside `rheged-studio`. The Rheged tag must not be newer than the root release, and the vendored catalogue copy must match `infrastructure/skill-catalogue.json` byte for byte.
- **rheged-skills-setup minor-bumped to 0.16.0.**
