---
title: Resolve CodeRabbit findings across the commit, changelog, release-status and initialise-skills bundles
release_note: 'Four canonical skill bundles get correctness fixes surfaced by CodeRabbit''s review of the Wave A re-vendor: the commit skill no longer treats a shared directory as enough to pull an uncommitted file in scope (a stray file from another branch/worktree could slip past the out-of-scope guard); the changelog scripts all use a symlink-safe CLI-entry check (enrich-changelog would otherwise skip its filesystem pass when run through a symlink); release-status no longer double-counts a PR merged earlier on the same calendar day as the last tag; and initialise-skills'' check-updates now fails loudly on a --source that has no skills/ directory instead of falsely reporting everything up to date.'
created_at: '2026-07-06T14:45:21Z'
merged_at: '2026-07-06T15:20:30Z'
branch: a-710-coderabbit-findings-on-the-canonical-bundles-surfaced-by-the
pr: 106
commit: bf4328b
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-710
stats:
  files_changed: 21
  loc_added: 274
  loc_removed: 120
  commits: 8
version: 1.2.0
---

## Fixed

CodeRabbit's review of the [R-681](https://linear.app/rheged-studio/issue/R-681) Wave A re-vendor flagged defects in the canonical
bundle _source_. Per the [R-573](https://linear.app/rheged-studio/issue/R-573) disposition these are fixed upstream here and
propagate to consumers on the next sync.

**`commit` (0.1.0 → 0.1.1) — in-scope rule.** Directory-level auto-inclusion ("any
uncommitted file sitting in a directory the branch already touches") could sweep in a
stray file from another branch or worktree that happened to land in a touched
directory, weakening the out-of-scope guard the skill exists to enforce. In-scope is
now restricted to files whose path the branch changed **directly** (plus the
fresh-branch case); directory-only matches are treated as out-of-scope/uncertain
unless the user confirms them.

**`changelog` (0.9.1 → 0.9.2) — symlink-safe CLI-entry check.** `enrich-changelog.mjs`
still used the old `import.meta.filename === argv[1]` entry check, a false negative
when the script is invoked through a symlink (macOS `/var`→`/private/var`, pnpm's
store) — so its filesystem pass would silently not run. The `realpathSync`-based
`isCliEntry()` (already duplicated verbatim in several sibling scripts) is now a
single shared helper in `scripts/lib/cli-entry.mjs`, and all eight scripts route
through it. The `enrich-changelog` `--self-test` now exercises the blank→resolved
`pr` path it previously skipped (the fixture pre-set `pr: 1`, so the fill branch
never ran).

**`release-status` (0.1.1 → 0.1.2) — same-day double-count.** `gh`'s `merged:>=<date>`
search only honours day precision, and `sinceDate` was truncated to `YYYY-MM-DD`, so
a PR merged earlier on the same calendar day as the last tag slipped past the bound
and was counted twice — once in the release it already shipped in, and again toward
the next bump. The day-granularity date is kept as `gh`'s coarse lower bound and the
results are re-filtered against the tag's full ISO timestamp. Two SKILL.md wording
nits are tidied alongside.

**`initialise-skills` (0.10.0 → 0.10.1) — misconfigured `--source`.** In working-tree
mode (no `--ref`) `check-updates` diffs against `<source>/skills`, which returns an
empty set for a missing directory — so a mistyped or bundle-less `--source` reported
every locked skill as "removed" yet still claimed "All installed skills are up to
date". It now fails loudly when `<source>/skills` is absent. The SKILL.md
prerequisites are also reworded so a missing repo-admin `gh` scope maps to the
"can't verify" outcome rather than the `/install-github-app` (absent) reminder.
