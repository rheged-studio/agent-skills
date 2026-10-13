---
title: Resolve Wave B CodeRabbit findings across the commit, initialise-skills and release-status bundles
release_note: 'Three canonical skill bundles get correctness fixes surfaced by CodeRabbit''s review of the Wave B re-vendor: the commit skill no longer auto-promotes every uncommitted file to in-scope on a fresh, commit-less branch (a stray file from another branch/worktree could otherwise be swept past the out-of-scope guard); initialise-skills'' check-updates no longer masks a real git failure as ''file absent'', and its merge --set report now reads the replaced value from the original config rather than an in-run detector-inferred one; and release-status now honours the mainBranch config knob (filtering gh pr list by --base) and raises its merged-PR window from 100 to 1000 so a stalled pipeline with a large backlog isn''t under-counted or mis-classified.'
created_at: '2026-07-06T17:55:19Z'
merged_at: '2026-07-06T19:18:01Z'
branch: a-719-coderabbit-findings-on-the-canonical-bundles-surfaced-by-the
pr: 109
commit: 16e56b1
merge_strategy: squash
author: hello@robeasthope.com
co_authors: []
category: fix
breaking: false
issues:
  - R-719
stats:
  files_changed: 12
  loc_added: 190
  loc_removed: 32
  commits: 5
version: 1.2.0
---

## Fixed

CodeRabbit's review of the [R-681](https://linear.app/rheged-studio/issue/R-681) Wave B re-vendor flagged defects in the canonical
bundle _source_ (sibling of [R-710](https://linear.app/rheged-studio/issue/R-710), which covered Wave A). Per the
[R-573](https://linear.app/rheged-studio/issue/R-573) disposition, these are fixed upstream here and propagate to consumers on the
next sync.

**`commit` (0.1.1 → 0.1.2) — fresh-branch out-of-scope guard.** [R-710](https://linear.app/rheged-studio/issue/R-710) tightened the
directory-only leak but kept the fresh-branch escape hatch: on a branch with no
commits of its own, _every_ uncommitted file was treated as in-scope. That reopened
the exact leak the guard exists to close — a stray file left by another branch or
worktree would be swept in silently. With no branch history, there is nothing to
distinguish the user's own work from a stray file, so all uncommitted files now land
in the uncertain bucket and require confirmation before staging.

**`initialise-skills` (0.10.1 → 0.10.2) — git-error masking and the `--set` report.**
`check-updates`' `gitShow()` caught every git failure and returned "absent", so a real
error (git off PATH, a corrupt object, permissions) silently degraded the version
diff instead of surfacing; it now treats only git's genuine not-found signal as the
expected absence and warns on anything else. Separately, `merge.mjs`'s `--set`
override read `had`/`from` from the post-mutation `data`, so when a key had both a live
detector and a `--set` the dry-run report showed the in-run inferred value (or marked
a never-set key as previously set) rather than the real previous `config.json` value;
it now reads them from the original config. Two regression tests cover the previously
broken cases.

**`release-status` (0.1.2 → 0.1.3) — unused `mainBranch` and a truncated PR window.**
The documented `mainBranch` config knob was never referenced, so a non-`main` trunk
had no effect — it is now threaded through every `gh pr list` call as `--base
<mainBranch>`. The merged-PR window was also hardcoded to `--limit 100`, which
truncates exactly when this tool is most needed (diagnosing a _stalled_ pipeline, when
a large backlog may have merged since the last tag) — under-reporting the count and,
because `gh pr list --search` isn't guaranteed merge-date sorted, potentially dropping
the strongest-bump title. The limit is raised to 1000 with a truncation warning. The
README now distinguishes the source repo (ships `config.example.json` only) from a
consumer's vendored bundle (which commits the resolved `config.json`).
