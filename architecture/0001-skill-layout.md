# ADR-0001: Skill layout, distribution, and versioning

- **Status:** Accepted
- **Date:** 2026-05-27
- **Tracking:** [R-133](https://linear.app/rheged-studio/issue/R-133)
- **Supersedes:** —
- **Superseded by:** [ADR-0002](0002-repo-level-npm-versioning.md) supersedes **Decision 1** (per-skill versioning via pnpm workspaces). Decisions 2–4 stand; ADR-0002 amends how Decision 2's semver semantics apply (to the out-of-band `metadata.version` label) and withdraws Decision 4's per-skill Git-tag scheme.

## Context

This repo is a container for shared agent skills distributed as [skills.sh](https://skills.sh)-compatible bundles, following the open [Agent Skills specification](https://agentskills.io/specification) originated by Anthropic. Consumers install with `npx skills add <git-url> --skill <name>`, which fetches directly from this Git repo — there is no npm registry or centralized skills.sh registry in the path. The bootstrap (R-132) deliberately deferred the foundational structural questions to this ADR:

1. **Versioning** — single root version vs. independent per-skill versions, and the semver semantics of each bump. (Addressed across Decisions 1 and 2 below.)
2. **Bundle layout** — what files a `skills/<name>/` directory must contain, and the `SKILL.md` manifest schema. (Decision 3.)
3. **Distribution conventions** — how consumers pin (branch, tag, SHA), Git tag naming, release cadence, deprecation. (Decision 4.)

This ADR resolves all three. Findings are verified against the canonical Agent Skills specification and the [vercel-labs/skills](https://github.com/vercel-labs/skills) CLI source as of 2026-05-27; a later ADR should supersede this one if either spec moves.

## Decision 1 — Per-skill versioning via pnpm workspaces

Each `skills/<name>/` is its own workspace package with its own `package.json`, version, and CHANGELOG. Versions are independent — a fix in one skill does not bump any other.

### Mechanics

- `pnpm-workspace.yaml` declares `skills/*` as workspaces.
- Each `skills/<name>/package.json` carries:
  - `name`: `@rheged-studio/skill-<name>`. The `skill-` prefix prevents collisions with potential future non-skill packages in this org and makes the role obvious in any consumer's `node_modules`. **This is distinct from the skill's `SKILL.md` `name` field**, which the Agent Skills spec mandates must equal the parent directory name (e.g. `cleanup-repo`).
  - `version`: starts at `0.1.0` (see Decision 2 for why not `0.0.1`).
  - `private: true` — these are not npm-published; skills.sh consumes the Git tree directly. The flag keeps an accidental `pnpm publish` a no-op.
- `.changeset/config.json` keeps `fixed` and `linked` unset so versions move independently. The root `@rheged-studio/agent-skills` package stays `private: true` and should be added to Changesets' `ignore` list so it never appears in Version Packages PRs.
- Git tag format follows the Changesets default: `@rheged-studio/skill-<name>@<version>` (e.g. `@rheged-studio/skill-cleanup-repo@1.2.0`). See Decision 4 for how consumers use these.

### Rejected alternatives

- **Single root version.** Simpler, but conflates unrelated skills: a `cleanup-repo` fix would imply (via version bump) that every other skill also changed. Acceptable for a single-skill repo; wrong shape for a container of many.
- **No explicit versions, pin to Git SHA or `main`.** Works mechanically, but loses per-skill changelogs and makes "what changed since I last installed" a `git log` exercise. Acceptable only as an escape hatch.

## Decision 2 — Semver discipline for skills

The Changesets workflow asks for `major` / `minor` / `patch` per change. For skills specifically, those mean:

- **Major** — breaking changes from a consumer's perspective: removed capabilities; renamed or removed `SKILL.md` frontmatter fields; restructured bundle in a way that affects `--copy` (e.g. moving a referenced script); instruction changes that meaningfully alter when or how the skill fires (a consumer pinned to the previous major should opt in deliberately).
- **Minor** — additive, backwards-compatible: new capabilities; expanded trigger language in `description`; new optional frontmatter fields under `metadata`; new optional sibling files in `scripts/`, `references/`, or `assets/`.
- **Patch** — no behavioural surface area change: typo fixes; clarifications that don't change behaviour; internal refactors of helper scripts that don't alter observable behaviour.

### Initial version and the 1.0 graduation rule

- Each skill starts at `0.1.0` (not `0.0.1`). The leading `0.` signals "released, but pre-1.0 — minor bumps may include breaking changes, per [SemVer §4](https://semver.org/#spec-item-4)."
- A skill graduates to `1.0.0` when both are true: (a) it has at least one external consumer, and (b) its trigger contract — the `description` field plus the body's stated when-to-use rules — is stable enough to commit to backwards-compatibility.
- Below `1.0.0`, treat the **minor** bump as the de-facto compatibility break: an `0.x → 0.(x+1)` move may include breaking changes; patch bumps within an `0.x` are still strictly compatible.

### Optional version mirror in `SKILL.md`

The Agent Skills spec has no top-level `version` field but allows arbitrary `metadata.*` keys. Skills MAY mirror their `package.json` version into `metadata.version` for runtime introspection. This mirror is optional and informational; the `package.json` version + Git tag remain the source of truth.

## Decision 3 — Bundle layout

A skill bundle conforms to the canonical Agent Skills spec, plus our workflow additions for versioning:

```text
skills/<name>/
├── SKILL.md         # Required by spec — manifest + instructions
├── package.json     # Required by this ADR — Changesets workspace package
├── README.md        # Optional — per-skill consumer install instructions
├── scripts/         # Optional (spec) — executable code the skill invokes
├── references/      # Optional (spec) — additional documentation loaded on demand
├── assets/          # Optional (spec) — templates, schemas, static resources
└── ...              # Any additional files allowed by the spec
```

### `SKILL.md` frontmatter

Required by the spec:

- **`name`** (string, max 64 chars, `[a-z0-9-]`, no leading/trailing/consecutive hyphens) — **must equal the parent directory name**. For `skills/cleanup-repo/SKILL.md`, the field is `name: cleanup-repo`.
- **`description`** (string, max 1024 chars, non-empty) — what the skill does _and_ when to use it. This is read at agent startup (progressive disclosure stage 1), so it is the trigger contract and the load-bearing field for whether the skill ever fires. Vague descriptions cause silent misses; specific keywords + when-clauses are required.

Optional by the spec, and how we use them:

- **`license`** — set to `MIT` to mirror the repo `LICENSE`, unless a specific skill bundles a different license file.
- **`compatibility`** — set only when the skill has non-obvious environment requirements (e.g. requires `gh` CLI, network access, specific Node version). Omit otherwise.
- **`metadata`** — used for `version` mirror (see Decision 2) and any other ACME-internal annotations. Prefix custom keys with `acme-` to avoid future collisions (e.g. `metadata.acme-deprecated-since`).
- **`allowed-tools`** — experimental per the spec; treat as advisory. Set if a skill is meant to run within a tool-restricted agent context.

### Self-containment rule

All file references in `SKILL.md` and bundled scripts MUST resolve relative to the skill's own root directory (`skills/<name>/`). No `../../` reaches into the source repo, no absolute paths, no references to sibling skills. This is required by the Agent Skills spec ("use relative paths from the skill root") because `--copy` lifts the bundle directory verbatim into the consumer's project, where parent paths point somewhere entirely different.

### Body length

Keep `SKILL.md` body under 500 lines (~5000 tokens) per spec guidance. Move long-form material to `references/<topic>.md` files that the body links into; those are loaded on demand, not at activation.

### Validation

The reference validator `skills-ref` (from `agentskills/agentskills`, published to npm as [`skills-ref`](https://www.npmjs.com/package/skills-ref)) is the canonical lint:

```bash
npx skills-ref validate ./skills/<name>
```

Confirmed installable via `npx` as of 2026-05-27 (v0.1.5). This becomes the manifest-lint step in `validate.yml` when R-134 lands, per CLAUDE.md's deferred plan.

## Decision 4 — Distribution conventions

### Default consumer pin: `main`

The `vercel-labs/skills` CLI as of 2026-05-27 accepts these URL forms for `npx skills add`:

- `owner/repo` shorthand
- `https://github.com/owner/repo` full URL
- `https://github.com/owner/repo/tree/<branch>/skills/<name>` direct skill path
- GitLab URLs, generic Git URLs, local paths

**It does not expose a `--ref` flag for pinning to a tag or SHA.** Consumers therefore install from `main` by default. We accept this; our compensating discipline is that `main` is always release-ready (Changesets workflow gates behavioural changes behind a Version Packages PR).

### Tag-pinning escape hatch

We still publish Git tags (`@rheged-studio/skill-<name>@<version>`) via Changesets, even though the CLI can't consume them directly. Consumers who need a pinned version can:

1. `git clone --branch <tag>` this repo locally, then `npx skills add ./local-path --skill <name>`. Pinned exactly to the tag.
2. Substitute the tag into the `tree/<ref>/...` URL form — likely works since GitHub resolves tags as refs, but not officially documented by the CLI. Use at your own risk.

This is a known limitation of the current skills.sh CLI; a future ADR may revise this section if the CLI gains ref-pinning.

### Per-skill install instructions live in the skill's own README

Each `skills/<name>/README.md` documents the install command for that skill specifically. The root `README.md` points consumers to the per-skill READMEs rather than enumerating commands.

### Release cadence

Changesets entries accumulate as PRs land on `main`. The release.yml workflow opens a "release: version packages" PR; merging that PR is the publish — it bumps versions, writes CHANGELOG, tags, and cuts a GitHub release. There is no fixed release schedule; merge the version PR when convenient. `pnpm changeset publish` runs at release time but is a no-op while packages are `private: true`.

### Deprecation and removal

The Agent Skills spec has no native deprecation field. Our protocol:

1. Set `metadata.acme-deprecated: true` in the skill's `SKILL.md`, plus `metadata.acme-deprecated-since: "YYYY-MM-DD"` and `metadata.acme-deprecated-reason: "<short text>"`. Agents that read `metadata.*` will surface this; agents that don't are at least no worse off than before.
2. Add a `## Deprecated` section at the top of the SKILL.md body explaining the deprecation and pointing at a replacement skill if one exists.
3. Ship the deprecation as a **minor** bump (additive metadata), then **major** bump when the skill is removed entirely (the directory is deleted, breaking `--copy` for consumers that hadn't updated).
4. Document both events in the CHANGELOG via Changesets entries.

If the spec adds a native deprecation field later, switch to it and supersede this ADR section.

## Consequences

- Adding a skill is a workspace change: it needs `SKILL.md` (matching parent dir name), `package.json` (named `@rheged-studio/skill-<name>`, `private: true`, version `0.1.0`), and a `.changeset/<slug>.md` referencing the package name.
- Migrating later from per-skill versions or from the chosen name pattern would break any pinned consumers — so the decision is locked before skill #1 lands.
- The CLI's lack of `--ref` pinning is an accepted limitation; we publish tags anyway so consumers have a recovery path via local-clone.
- Manifest lint joins `validate.yml` with R-134, using `skills-ref validate` against every `skills/<name>/` directory.
- The root `@rheged-studio/agent-skills` package must be added to Changesets' `ignore` list when workspace plumbing lands.

## Out of scope

- Workspace plumbing (`pnpm-workspace.yaml`, Changesets `ignore` entry, skill `package.json` template) — tracked in the sibling ticket created from this ADR.
- Skill #1 (`cleanup-repo`) — R-134.
- Manifest lint wiring in `validate.yml` — joins R-134 per CLAUDE.md.
- Husky / lint-staged / commitlint — deferred to first skill per CLAUDE.md.
- Testing conventions for skills — future ADR.
