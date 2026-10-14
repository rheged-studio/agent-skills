# ADR-0005: Dual merge policy (feature merge commits; release and fan-out squash)

- **Status:** Accepted
- **Date:** 2026-08-03
- **Tracking:** [R-1176](https://linear.app/rheged-studio/issue/R-1176)
- **Supersedes:** —
- **Amends:** [ADR-0003](0003-release-please-versioning.md) Decision 1 (bump source under merge commits)
- **Amended by:** [R-1151](https://linear.app/rheged-studio/issue/R-1151) — send-it 0.8.0 removed `--merge-when-ready`, so it no longer arms `gh pr merge --auto --merge`; the two body references below are historical. The merge-commit decision itself stands, and merging by hand (or arming auto-merge yourself) still uses `--merge`, never `--squash`.
- **Related:** [R-1175](https://linear.app/rheged-studio/issue/R-1175) (release + fan-out stay squash), [R-1177](https://linear.app/rheged-studio/issue/R-1177) (keep squash allowed), [R-824](https://linear.app/rheged-studio/issue/R-824) (commit-subject bumps), [R-823](https://linear.app/rheged-studio/issue/R-823) / [R-983](https://linear.app/rheged-studio/issue/R-983) (Commitlint / validate-commits)

## Context

ADR-0003 adopted release-please and assumed the repo **squash-merges**: the merged PR title _was_ the Conventional-Commit squash subject, and therefore the sole bump signal. That model is simple when every merge collapses the branch to one commit, but it discards the authored commit history that agents and humans already write as Conventional Commits.

The estate is moving feature and ship PRs to **merge commits** so landed commit subjects remain on trunk for release-please to rank (R-824). Release-please version PRs and mechanical fan-out PRs must **stay squash** (R-1175): a merge commit on those paths would pollute trunk with bot commit noise or break the orchestrator's release-PR reconcile. Squash must remain an allowed repo setting (R-1177) — documenting "squash disabled" would be wrong.

Commit-subject bumps only work if every commit that lands is Conventional. That requires Commitlint / `reusable-validate-commits` as a required check (R-823 / R-983), not merely a PR-title lint.

## Decision

**Dual merge policy for this repo (and the send-it skill that ships against it):**

1. **Feature / ship PRs → merge commits.** Prefer `gh pr merge --merge` (including `/send-it --merge-when-ready` → `gh pr merge --auto --merge`). After merge, release-please ranks Conventional-Commit **subjects** on trunk for the bump (highest wins: breaking → major, `feat` → minor, `fix`/`perf`/`revert` → patch). The PR title stays a Conventional Commits declaration for CI and humans, and should match the **dominant** type across the branch's commits (R-387); it is **not** the sole post-merge bump signal for feature PRs.
2. **Release-please version PRs → squash.** The orchestrator continues to squash-merge `release-please--branches--*` once `GO/NO GO` is green (R-1175).
3. **Fan-out PRs → squash.** Mechanical re-sync / fan-out automation keeps squash (R-1175).
4. **Both merge methods stay allowed.** Repo settings keep `allow_merge_commit` **and** `allow_squash_merge` enabled (R-1177). Do **not** document disabling squash.
5. **Validation boundary.** PR-title lint + changelog completeness remain; they declare intent and gate the dated entry. **Commitlint / validate-commits** (R-823 / R-983) is the prerequisite that makes commit-subject bumps trustworthy under merge commits. send-it's `derive-bump` scans `git log --no-merges` so a merge subject's body is not mixed into the pre-merge dominant-type scan.

## Rejected alternatives

- **Squash-only forever.** Rejected: discards authored Conventional Commits and forces the PR title to carry the entire bump signal.
- **Merge-only (disable squash).** Rejected: release and fan-out paths need squash (R-1175); R-1177 keeps squash allowed.
- **Rely on PR title alone after switching feature PRs to merge commits.** Rejected: under a merge commit the PR title is not the only landed subject; release-please must read commit subjects (R-824).

## Consequences

- `/send-it` documentation and `--merge-when-ready` use `--merge`, not `--squash`.
- ADR-0003 Decision 1 is amended: under feature merge commits the bump comes from landed commit subjects; the PR title remains the declaration for **squash** paths and the CI/human signal on every PR.
- Orchestrator behaviour for release PRs is unchanged (squash).
- Consumers of the send-it skill inherit the dual-policy wording; repos that remain squash-only still get an honest PR title from `derive-bump`.
