# ADR-0003: release-please replaces Changesets as the version engine

- **Status:** Accepted
- **Date:** 2026-06-23
- **Tracking:** [R-380](https://linear.app/rheged-studio/issue/R-380)
- **Supersedes:** [ADR-0002](0002-repo-level-npm-versioning.md) _mechanism_ only — Decision 4 (the Changesets package-name guard) in full, and the Changesets-engine framing in Decisions 1–2. ADR-0002's core decision (repo-level npm versioning; the root is the single published package; skills versioned out-of-band) **stands unchanged**.
- **Superseded by:** —

## Context

ADR-0002 settled _what_ is versioned — the root `@rheged-studio/agent-skills` as a single repo-level package, with skills versioned out-of-band via `SKILL.md metadata.version`. It assumed **Changesets** as the engine that decides the bump: every PR wrote a root-named `.changeset/*.md`, a CI guard (`validate-changesets.ts`) rejected skill-named changesets, and Clacks (`rheged-studio/clacks`) ran `changeset version` to cut the version PR.

The `@rheged-studio` estate is standardising on **release-please** (Conventional Commits) for cross-repo consistency — the estate-wide ADR 0002 lives in eslint-config, ported to the siblings as R-371 (eslint-config), R-379 (markdownlint-config), and **R-380 (this repo)**. At adoption time the estate squash-merged, so release-please inferred the bump from the merged Conventional-Commit **PR title** (the squash subject) instead of an explicit changeset file. _(Amended R-1176 / [ADR-0005](0005-dual-merge-policy.md): feature PRs now use merge commits and the bump comes from landed commit subjects; release and fan-out PRs stay squash.)_ Keeping Changesets here while the rest of the estate flips would leave one repo with a divergent release flow and a second engine to maintain.

The change is **strand A only**: it swaps the engine that decides the bump. Everything else ADR-0002 fixed — repo-level single package, `files: ["skills/"]` as the published surface, no `pnpm-workspace.yaml`, skills versioned by hand — is untouched.

## Decision

**release-please (Conventional Commits) replaces Changesets as the version engine. The repo-level single-package model from ADR-0002 is unchanged.**

1. **The bump is decided by Conventional Commits on trunk**, not a changeset file. Mapping: `feat:` → minor, `fix:`/`perf:`/`revert:` → patch, `!`/`BREAKING CHANGE:` → major; `docs`/`chore`/`ci`/`refactor`/`test`/`build`/`style` cut no release. `/send-it` maps shippable changes to `feat`/`fix`/`feat!` only; release-please still bumps on a manually titled `perf:` or `revert:`. Under the original squash-only assumption the merged **PR title** was the sole declaration; under the dual merge policy ([ADR-0005](0005-dual-merge-policy.md) / R-1176) **feature PRs** land as merge commits and release-please ranks landed **commit subjects**, while **release** and **fan-out** squash paths still use the squash subject as the declaration. release-please bumps `package.json` + `.release-please-manifest.json` and opens the `release-please--branches--main` release PR.
2. **`release-please-config.json` is a single-package config** (`packages: { ".": … }`, `release-type: node`, `include-v-in-tag: true`, `skip-changelog: true`). There is **no root `CHANGELOG.md`** — the dated `changelog/` entries are the only changelog, and `release.yml` sources GitHub-release notes from the entry stamped with the release version.
3. **Two CI guards replace the changeset guard.** A SHA-pinned conventional-PR-title lint (`amannn/action-semantic-pull-request`) checks the title format; a changelog-completeness gate (`check-changelog-completeness.ts`) requires a `feat`/`fix`/breaking title to carry a dated `changelog/*.md` entry — restoring the "no changeset → no release" coupling Changesets gave for free. ADR-0002's `validate-changesets.ts` guard and the `pkg` field in `derive-changeset.ts` are removed (there are no changeset files to validate).
4. **`/send-it` composes the PR title** from the branch's derived bump (shippable → `feat`/`fix`/breaking; non-shippable → a non-release type) and writes the dated `changelog/` entry for shippable changes. Shippability is keyed on `files: ["skills/"]`: a change is shippable iff it touches `skills/` or a publish-surface `package.json` key. _(Amended R-598/R-600 — release-type is now decided by the change's semantic category, not path, and a `changelog/` entry is authored for every PR. See [Amendments](#amendments).)_
5. **The orchestrator runs release-please.** The private `release-orchestrator` swaps `changeset version` for `release-please release-pr` + `changelog:finalise`, then SHA-pinned squash-merges the release PR; the merge re-fires the publish-only `release.yml`, which publishes on a keyless **version-vs-tag** gate (publish iff `package.json`'s version has no matching `v<version>` tag). Landed together: this repo's config first, the orchestrator (release-orchestrator PR #11) immediately after.

## What this means in practice

- **Skills are still versioned out-of-band** (ADR-0002 Decision 3) — `metadata.version` + the private `package.json` version, bumped by hand, enforced by `pnpm validate:skills`. release-please never touches them.
- **One tag / GitHub release per root version**, as before (`v1.1.0`, now `v`-prefixed via `include-v-in-tag`).
- **Mis-typing Conventional Commits is the failure mode** Changesets used to absorb: a `feat:` on a docs change cuts a needless minor; a `chore:` on a real fix ships nothing. Under squash, the PR title was the single subject; under feature merge commits, every landed commit subject counts (R-824). The PR-title lint guards the PR declaration, Commitlint / validate-commits guards commit subjects (R-823 / R-983), and the completeness gate guards the dated entry — but the human (or agent) picking the type remains responsible.

## Rejected alternatives

- **Keep Changesets here.** Rejected: it leaves this repo as the estate's lone divergent release flow, against the cross-repo-consistency driver of ADR-0002.
- **Adopt release-please's own changelog (`skip-changelog: false`).** Rejected: the dated `changelog/` system (ADR-0002 / R-345) is richer (per-change frontmatter, enrichment, Linear links) and is what `release.yml` and consumers already read. release-please runs with `skip-changelog: true` so the two don't collide.

## Consequences

- ADR-0002's Decision 4 is withdrawn and its Decision 1–2 wording ("Changesets-managed", `.changeset/config.json`) is superseded by the release-please equivalents above; **its core decision (repo-level single published package, skills out-of-band) is unchanged**.
- Adding or changing a skill is now: edit the bundle, hand-bump its `metadata.version` + `package.json` `version`, and let `/send-it` set a `feat`/`fix` PR title + write the dated `changelog/` entry (no changeset file).
- A future ADR may revisit per-skill npm publishing if the distribution model changes; this ADR would then be superseded in turn.

## Amendments

- **R-598 / R-600 (2026-06-30) — release-type by category, an entry for every PR.** Decision 4 (and Decision 1's "`/send-it` maps shippable changes to `feat`/`fix`/`feat!`" clause) described `/send-it` deciding release-type by **path** (`shippablePaths` / `files: ["skills/"]`) and authoring a `changelog/` entry only for shippable changes. Both are superseded:
  - **Release-type is decided by the change's semantic category** — the Conventional-Commit type of the work `/send-it` committed — **not by which paths the diff touches** (R-598). `feat`/`fix`/`perf`, or any breaking change, cut a release; `docs`/`refactor`/`chore`/`ci`/`build`/`test`/`style` do not, wherever the files live. This fixes a docs-only edit inside `skills/` being mis-titled `feat:`/`fix:` and cutting a spurious release. `shippablePaths` / `shippableManifestKeys` are retained as an **advisory** publish-surface hint only.
  - **A dated `changelog/` entry is authored for every PR** (release-triggering or not), gated only by the `changelog: true|false` master switch — the "record everything, filter later" model; release notes filter the changelog to the version-stamped entries at release time. The interim `changelogScope` knob (added under R-576) is removed (R-600).
  - This does **not** change the release **engine**: release-please still reads Conventional Commits on trunk. Only how `/send-it` _derives_ the PR title — by category rather than path — and that it always writes the dated entry.

- **R-1176 (2026-08-03) — dual merge policy; bump source under merge commits.** Decision 1 and the Context's "repo squash-merges / title _is_ the release declaration" framing assumed every merge was squash. That is amended by [ADR-0005](0005-dual-merge-policy.md):
  - **Feature / ship PRs** land as **merge commits**. After merge, release-please ranks landed Conventional-Commit **subjects** for the bump (R-824), not the PR title alone.
  - **Release-please version PRs** and **fan-out PRs** stay **squash** (orchestrator / fanout-spine — R-1175). For those paths the squash subject (often the PR title) remains the bump declaration.
  - Both `allow_merge_commit` and `allow_squash_merge` stay enabled (R-1177).
  - The PR title remains the CI/human Conventional Commits declaration on every PR (and the completeness-gate input); `/send-it` still composes it from the dominant type across branch commits (R-387). Under feature merge commits it is no longer the sole post-merge bump signal.
