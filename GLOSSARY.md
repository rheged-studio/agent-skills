# Agent Skills

The source repo for the Rheged Studio shared agent skills, distributed as skills.sh bundles to every estate repo. It publishes the skills; it does not consume them, apart from dogfooding its own.

## Language

### Distribution

**Bundle**:
A self-contained skill directory at `skills/<name>/`, with a `SKILL.md` manifest at its root and its own `package.json`. A bundle is the unit a consumer installs.
_Avoid_: Package, plugin, skill folder

**Consumer**:
Any estate repo that installs bundles from this repo via `npx skills add … --copy`. This repo is the source, never a consumer of its own `skills/`.
_Avoid_: Downstream, target repo, client

**Estate catalogue**:
The install set in `infrastructure/skill-catalogue.json`: the Rheged bundles from this repo plus the Matt Pocock packs from `mattpocock/skills`. `rheged-skills-setup --install` reads it.
_Avoid_: Skill list, manifest

**Re-vendor**:
Re-running a `--copy` install in a consumer to refresh its vendored bundles. It clobbers each tracked `config.json`, which must be restored before reconciling.
_Avoid_: Reinstall, upgrade, resync

**Fan-out**:
A mechanical rollout PR that applies one change across many estate repos. Fan-out PRs are squash-merged.
_Avoid_: Rollout, broadcast

**Vendored lib**:
A copy of a canonical `lib/` module written into a bundle under `scripts/lib/vendor/`, so the bundle stays standalone. `pnpm vendor:check` fails CI if a copy drifts.
_Avoid_: Shared module, symlinked lib

### Configuration

**Dogfood config**:
The tracked per-skill settings under `infrastructure/dogfood-config/<name>.json`. `pnpm bootstrap:config` materialises them into the gitignored `skills/<name>/config.json` for this repo's own use.
_Avoid_: Local config, self-config

**Example config**:
The neutral `config.example.json` that ships inside a bundle. A consumer's real `config.json` is generated from it plus facts detected from the host repo, and the two must keep identical key sets.
_Avoid_: Default config, template config

**Reconcile**:
Bringing a consumer's `config.json` files into line with facts detected from its repo (base branch, changelog directory, Linear keys). `rheged-skills-setup` does this and is idempotent.
_Avoid_: Sync, configure

**Trunk**:
The git branch everything merges into. The diff-based skills (`changelog`, `send-it`) name it `baseBranch`; `cleanup-repo` names it `mainBranch`. The divergence is deliberate because the two roles differ, so do not converge them.
_Avoid_: Default branch, master

### Versioning

**Skill version**:
A bundle's own non-npm version, held in its `package.json` `version` and mirrored in `SKILL.md` `metadata.version`. It is bumped by hand when that bundle changes.
_Avoid_: Bundle version, release version

**Package version**:
The version of the root `@rheged-studio/agent-skills` npm package, bumped by release-please from Conventional Commits. It is independent of every skill version.
_Avoid_: Repo version, npm version

### Ship pipeline

**Phase A**:
The `triage-pr` stage that runs while a PR is a draft: it fixes in-scope CI failures unattended until checks are green.
_Avoid_: CI loop, draft phase

**Phase B**:
The `triage-pr` stage that runs once a PR is ready-for-review: it verifies reviewer findings, then proposes dispositions, halting at the human envelope by default.
_Avoid_: Review phase, review loop

**Human envelope**:
The `humanEnvelope` setting under which `triage-pr` halts at Phase B for a person to approve dispositions before any are applied. `--auto-apply` skips it.
_Avoid_: Approval gate, review gate

**Changelog entry**:
A dated, per-PR Markdown file at `changelog/<timestamp>-<slug>.md`. `changelog-core validate` checks it, and post-merge enrichment fills its merge metadata.
_Avoid_: Release note, CHANGELOG
