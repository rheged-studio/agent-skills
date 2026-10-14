---
title: Stop the skills fan-out wedging — scope check-updates to the canonical set and wipe before re-copy
release_note: The skills-update fan-out could never vendor an agent-skills release to a consumer because check-updates counted the repo-internal scaffold-new-skill — present in every source checkout but installed by no consumer — as a perpetual "added" update, so the post-roll verify was behind forever and no PR ever opened. check-updates now takes a --skills allow-list that scopes the diff to a consumer's canonical install set (both sides), and fleet-update wipes each install skill's vendored bundle dir before "skills add --copy" so a fresh SKILL.md always lands regardless of the CLI's copy semantics, then scopes its verify to the same set.
created_at: '2026-07-07T14:32:55Z'
branch: a-741-skills-fan-out-never-vendors-fleet-update-apply-doesnt
category: fix
breaking: false
issues:
  - R-741
merged_at: '2026-07-07T14:48:34Z'
commit: 54b9bc2
merge_strategy: squash
pr: 115
stats:
  loc_added: 334
  loc_removed: 21
  files_changed: 7
  commits: 2
version: 1.2.2
---

## Fixed

The skills-update fan-out ([R-713](https://linear.app/rheged-studio/issue/R-713)) **never vendored anything**: every roll's
post-install verify reported the consumer as behind and the driver correctly
aborted, so no `chore(skills)` PR ever opened. Reproduced end-to-end against a
throwaway `markdownlint-config` — the `--copy` install and `initialise --write`
actually advanced the consumer's `.claude/skills.lock` correctly; the wedge was
**`check-updates`** counting `scaffold-new-skill` as an update.

**Root cause — a regression from [R-730](https://linear.app/rheged-studio/issue/R-730) (#113).**
That change made `updatesAvailable` reflect the `added` bucket as well as changed
locked skills, so a repo behind on a brand-new upstream bundle is no longer reported
"up to date". But the repo-internal `scaffold-new-skill` ([R-729](https://linear.app/rheged-studio/issue/R-729))
ships in every agent-skills checkout and is installed by **no** consumer, so it is
`added` on every consumer forever — `updatesAvailable` is stuck `true` and the
fan-out verify can never pass.

**`initialise-skills` (0.10.4 → 0.10.5).** `check-updates` gains an optional
`--skills <a,b,c>` allow-list that restricts the diff to a consumer's canonical
install set on **both** sides. Scoped to the set the fan-out actually installs,
`scaffold-new-skill` (upstream-only) drops out of `added` while a genuinely-new
**canonical** skill the consumer lacks is still `added` — so legitimate adoption
keeps firing and the [R-730](https://linear.app/rheged-studio/issue/R-730) intent is preserved. Omitting the flag (the local
"am I behind?" use) is unchanged.

**`fleet-update.mjs`.** The apply pipeline gains a **wipe** step before
`skills add --copy`: it removes each install skill's vendored bundle dir per mirror
so `--copy` writes fresh `SKILL.md` files even when the installed skills.sh CLI
does an additive copy that leaves stale versions on disk (the second failure mode
seen in the live canary). The config.json the wipe removes is restored immediately
afterwards by the existing [R-706](https://linear.app/rheged-studio/issue/R-706) step, and the post-roll verify now passes the
resolved skill set to `check-updates --skills`. A new `--print-skills` mode emits
the resolved set so the fan-out pre-flight can scope its probe identically.
