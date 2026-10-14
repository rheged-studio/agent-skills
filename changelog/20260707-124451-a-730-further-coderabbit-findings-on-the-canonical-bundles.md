---
title: Resolve further CodeRabbit findings across the initialise-skills, changelog and release-status bundles
release_note: initialise-skills now reports a repo that is behind on a brand-new upstream skill as having updates available (rather than "up to date"), never claims "up to date" alongside downgrades or uncomparable versions, surfaces each unset key's fallback default in its review output, distinguishes a genuine lock read error from a missing lock, and rejects prototype-polluting --set keys; release-status now reports a diagnosed error (naming what failed) when a gh call returns non-JSON, and its docs point at the tracked config template and list the --repo/--help flags.
created_at: '2026-07-07T12:44:51Z'
merged_at: '2026-07-07T13:38:09Z'
branch: a-730-further-coderabbit-findings-on-the-canonical-bundles-a-681
pr: 113
commit: 94d3b77
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-730
stats:
  loc_added: 367
  loc_removed: 32
  files_changed: 22
  commits: 5
version: 1.2.1
---

## Fixed

Second, larger batch of CodeRabbit findings against the vendored canonical bundles,
surfaced once the rate-limit window on the
[R-681](https://linear.app/rheged-studio/issue/R-681) Wave C/D consumer re-vendor
PRs cleared. Per the standing
[R-573](https://linear.app/rheged-studio/issue/R-573) disposition the findings are
fixed **upstream** here and reach consumers on the next fleet sync; the Wave C/D PRs
merged as faithful vendors ([R-730](https://linear.app/rheged-studio/issue/R-730)).

**`initialise-skills` (0.10.3 → 0.10.4).** `check-updates` now treats a brand-new
upstream bundle the consumer hasn't vendored as an update: `updatesAvailable` reflects
the `added` bucket as well as changed locked skills, so a repo behind on a whole new
skill is no longer reported "up to date" (the check is extracted as a `hasUpdates`
predicate). The human summary's "All installed skills are up to date." line is gated
on every partition being empty, so it can no longer print contradictorily above
downgrade / uncomparable-version / new-skill lines, and `gitShow` forces `LC_ALL=C`
so its absent-path stderr check stays deterministic in a non-English locale. The
`--review` output now surfaces each **unset** key's `fallback:` default (previously
carried in `--json` only). `readLock` reads and parses in separate steps so a genuine
IO error surfaces instead of being masked as "no lock" (a malformed lock still reads
as absent). `--set` rejects prototype-polluting keys (`__proto__` / `constructor` /
`prototype`) before its bracket-notation write, atop the existing example-key
allowlist.

**`release-status` (0.1.3 → 0.1.4).** Every `gh` / `package.json` `JSON.parse` now
runs through a `parseJson` helper that turns an opaque `SyntaxError` — a `gh` warning
line, an auth prompt, or empty output where JSON was expected — into a diagnosed error
naming what failed to parse. The SKILL.md Configuration section points at the tracked
`config.example.json` template rather than the generated, untracked `config.json`, and
the README usage block documents the real `--repo` and `--help` flags.

**`changelog` (0.9.2 → 0.9.3).** The `changelog-contract.md` release-orchestrator
ownership caveat now records that the enrichment cron leaves `commits` unfilled too,
not just `version` — matching the SKILL.md and the enricher's own comment — and
`enrich-changelog.mjs` imports `exit` from `node:process` and uses it throughout
instead of mixing the named `argv` / `env` import with a bare-global `process.exit`.

Each behaviour is covered by new vitest cases in the central suites. Not part of this
batch: the `initialise-skills` `merge.mjs` "recompute `changed`" item (already fixed
upstream by #110, [R-728](https://linear.app/rheged-studio/issue/R-728) →
initialise-skills 0.10.3), and the reported `send-it` SKILL.md item, which has no
basis in its cited source PR (shared-workflows#47 does not touch `send-it`; its only
CodeRabbit comment is a trivial locale nit on `check-updates.mjs`, folded in above).
