---
title: initialise-skills restores a --copy-clobbered config.json from HEAD before reconciling
release_note: A "skills add --copy" re-vendor deletes or overwrites each consumer's tracked per-skill config.json (agent-skills ships none of its own — R-615), and initialise-skills would then reconcile onto the wiped/example values, silently regressing every operator-supplied no-detector key (linearTeamName, changelog.packageRoots, …). initialise-skills now detects a config.json that git shows clobbered against HEAD and restores it from the trunk before reconciling under --write (a dry-run or --review warns instead), so a human running "skills add --copy" directly is protected the same way the fleet-update pipeline already protected the fan-out.
created_at: '2026-07-07T14:55:24Z'
branch: a-706-skills-add-copy-deletes-the-consumers-per-skill-configjson
category: fix
breaking: false
issues:
  - R-706
merged_at: '2026-07-07T15:16:01Z'
commit: c276a2a
merge_strategy: squash
pr: 116
stats:
  loc_added: 305
  loc_removed: 3
  files_changed: 6
  commits: 2
version: 1.2.2
---

## Fixed

**`initialise-skills` (0.10.5 → 0.10.6).** Re-vendoring the shared bundles into a
consumer with `npx skills add … --copy` performs a clean bundle-directory
replacement. Because agent-skills **gitignores** its own `config.json`
([R-615](https://linear.app/rheged-studio/issue/R-615)) the source bundle ships
none, so the `--copy` **deletes** (older CLIs) or **overwrites** (current CLIs, with
the neutral example) every consumer's **tracked** `config.json`. Running
`initialise.mjs` next then reconciled onto those wiped values and **silently
regressed every no-detector key** the operator had set — `linearTeamName`,
`linearWorkspaceSlug`, `changelog.packageRoots`, `triage-pr.promoteOnGreen`,
`release-status.*`, … — since the detector cannot re-infer them.

initialise-skills now runs an **auto-restore pre-pass** before the reconcile: it
asks git which of the discovered skills' `config.json` files are clobbered vs HEAD
(`git diff HEAD --diff-filter=DM`, scoped to those paths so nothing else is
touched) and, under `--write`, `git checkout HEAD --` restores them, then
re-reads them so the merge runs against the operator's **real** values. A dry-run
or `--review` only **warns loudly** (naming the clobbered files) rather than
mutating. It degrades to a no-op outside a git repo and on a first-ever install
(a never-committed config is untracked, not `D`/`M`, so it never matches).

This is the general-CLI counterpart to the restore the
[R-617](https://linear.app/rheged-studio/issue/R-617) `fleet-update` pipeline
already performs for the fan-out: now a human re-vendoring by hand is protected
too. The deeper fix — stopping `skills add --copy` deleting consumer-only files in
the skills.sh CLI itself (option 1) — remains tracked upstream on
[R-706](https://linear.app/rheged-studio/issue/R-706).
