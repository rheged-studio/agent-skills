# ADR-0002: Repo-level npm versioning; skills versioned out-of-band

- **Status:** Accepted
- **Date:** 2026-06-01
- **Tracking:** [R-364](https://linear.app/rheged-studio/issue/R-364)
- **Supersedes:** [ADR-0001](0001-skill-layout.md) Decision 1 (per-skill versioning via pnpm workspaces). ADR-0001 Decisions 2–4 still stand.
- **Superseded by:** [ADR-0003](0003-release-please-versioning.md) — _mechanism only_: the Changesets engine (Decision 4 in full; the Changesets framing in Decisions 1–2) is replaced by release-please. This ADR's core decision — repo-level npm versioning, the root as the single published package, skills versioned out-of-band — **still stands**.

## Context

ADR-0001 Decision 1 chose **per-skill versioning via pnpm workspaces**: each `skills/<name>/` would be its own Changesets-managed workspace package (`@rheged-studio/skill-<name>`), versioned independently, with the root `@rheged-studio/agent-skills` kept `private: true` and added to Changesets' `ignore` list. That decision was made (2026-05-27) on the premise that **the root is never published** — skills.sh consumes the Git tree directly and npm is not in the consumer path (ADR-0001 Decision 4).

That premise no longer holds. [R-358](https://linear.app/rheged-studio/issue/R-358) flipped the root to `private: false`, version `1.0.0`, and published it to npm as the public artifact that bundles every skill (`files: ["skills/"]`). The root is now the published tarball.

Meanwhile the workspace plumbing Decision 1 needs was never laid: there is no `pnpm-workspace.yaml` and no `workspaces` field, so Changesets only ever discovers the root. A changeset that names a per-skill package points at something Changesets can't see — it **silently no-ops**, or makes `pnpm changeset status` **error**. This trap has bitten the repo repeatedly (`cleanup-repo`'s `asw-134` never bumped; the `changelog` and `linear-sync` ports, [R-351](https://linear.app/rheged-studio/issue/R-351) / [R-352](https://linear.app/rheged-studio/issue/R-352), worked around it by naming the root).

Completing Decision 1 (add the workspace, `ignore` the root, version skills independently) would pull npm versioning _away_ from the repo level — the published root would freeze or stop being the bumped package — which is the opposite of what we want now that the root is the deliberate public artifact. So we resolve the tension the other way.

## Decision

**npm versioning stays at the repo level. Skills are versioned out-of-band, not by Changesets.**

1. **The root `@rheged-studio/agent-skills` is the single Changesets-managed, published package.** It versions as one number (`1.0.0 → 1.1.0 → …`) representing the collection as a whole. Every changeset names the root and only the root.
2. **No `pnpm-workspace.yaml`, no `workspaces` field, and `.changeset/config.json` `ignore` stays `[]`.** Changesets is intentionally kept aware of only the root. (This reverses ADR-0001 Decision 1's `pnpm-workspace.yaml` + root-in-`ignore` mechanics.)
3. **Skills carry their own version out-of-band.** Each skill keeps a `version` in its `private: true` `package.json`, mirrored into `SKILL.md` `metadata.version` (the mirror ADR-0001 Decision 2 already sanctions). It is bumped **by hand** per Decision 2's semver semantics when that skill changes. This label is for consumers and runtime introspection; it is decoupled from the root npm release and is **never** driven by a changeset. `pnpm validate:skills` (a hard gate in `validate.yml`) enforces the per-skill `package.json` naming/`private`/version rules and the `metadata.version` parity, so the metadata can't drift silently across skills.
4. **A CI guard makes wrong names fail loudly.** `infrastructure/scripts/validate-changesets.ts` (`pnpm validate:changesets`, a hard gate in `validate.yml`'s `🔬 Build & Lint`) asserts every `.changeset/*.md` names only the root. A skill-named changeset fails the build instead of silently no-op'ing. The `/send-it` changeset writer (`derive-changeset.ts`) emits the root package name as a `pkg` field so the contract lives in code, not prose.

### What this means in practice

- **npm:** one package, one moving version; the tarball ships all skills at whatever state they're in for that release. Skills themselves are never npm-published (they stay `private: true`).
- **Git tags / GitHub releases:** one tag and one release per root version (e.g. `@rheged-studio/agent-skills@1.1.0`), as today — not one per skill.
- **"What changed in skill X":** answered by the skill's `metadata.version` + its entry in the dated `changelog/` and the root `CHANGELOG.md`, not by a per-skill tag.

## Rejected alternatives

- **Complete ADR-0001 Decision 1 (per-skill Changesets packages).** The original plan. Rejected here because it moves npm versioning off the root just as the root became the deliberate public artifact, and it adds workspace machinery for a repo that publishes a single tarball. The per-skill _changelog_ and _semver_ discipline it wanted is preserved via the out-of-band `metadata.version` label instead.
- **Aggregate auto-bump (root bumped on every skill change via a dual changeset).** Keeps npm always fresh but adds a two-changeset-per-PR convention and contradicts the "name only the root" guard's simplicity. Repo-level bumps via a single root changeset already cover this when a release is wanted.

## Consequences

- ADR-0001 Decision 1 is superseded; its Decisions 2 (semver discipline), 3 (bundle layout), and 4 (distribution conventions) stand. Decision 2's semver semantics now govern the out-of-band `metadata.version` label rather than a Changesets-driven package version. Decision 4's Git-tag-per-skill escape hatch is withdrawn (tags follow the root version).
- The per-skill `package.json` stays (version source of truth, `repository`/`license` metadata, accidental-publish guard) but is **not** a workspace package.
- Adding or changing a skill is: edit the bundle, hand-bump its `metadata.version` + `package.json` `version`, and write a **root-named** changeset (or empty-frontmatter for docs/tooling-only).
- A future ADR may revisit per-skill npm publishing if skills.sh or the distribution model changes; this ADR would then be superseded in turn.
