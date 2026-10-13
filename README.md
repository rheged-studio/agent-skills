# agent-skills

Shared agent skills for Claude Code and Cursor, distributed as [skills.sh](https://skills.sh)-compatible bundles. Each skill lives under `skills/<name>/` with a `SKILL.md` manifest at its root.

## Installing a skill

From any consumer repo:

```bash
npx skills add https://github.com/rheged-studio/agent-skills --skill <name> --agent claude-code --agent cursor --copy
```

`--copy` writes real files (not symlinks) so the skill is portable across machines. Don't use `-g` / `--global` — installs should live in the consumer repo.

## Rolling the skills onto a repo

To deploy the shared set across a target repo — wipe its bespoke skill/command shims, install the canonical set, reconcile config, and verify — follow the [fleet deployment runbook](docs/fleet-deployment.md). It also covers the install-set per repo type, pinning to a tag, and the re-install/upgrade path.

## Repo layout

```text
.
├── .claude/commands/
│   └── send-it.md           # all-in-one finisher (stopgap until the send-it skill ships)
├── .github/
│   ├── actions/
│   │   └── (load-repo-config via shared-workflows @v1)
│   └── workflows/
│       ├── pkg-release.yml       # publish-only caller of shared-workflows' reusable-pkg-release.yml (npm OIDC + GitHub Packages)
│       ├── validate.yml          # PR gate: config + reusable lint/build-test callers, local skills + skill-manifests, GO/NO GO
│       └── validate-pr-title.yml # caller of reusable-validate-pr-title.yml (conventional PR title)
├── .husky/                  # git hooks (block main pushes; lint-staged; strip Claude trailer)
├── architecture/            # ADRs (sequentially numbered, immutable)
├── changelog/               # dated per-change release-note entries (the repo's only changelog)
├── release-please-config.json      # release-please packages config (single root package)
├── .release-please-manifest.json   # release-please version manifest
├── infrastructure/
│   ├── repo-config.yaml      # non-secret CI/release knobs
│   ├── scripts/              # validate-skills, ensure-*.sh bootstraps, fleet-wipe.mjs
│   └── tests/                # bats (ensure-*.sh) + vitest (changelog)
├── skills/                  # one folder per skill
├── AGENTS.md                # estate-wide shared agent instructions (vendored from shared-agents-md)
├── CLAUDE.md                # Claude Code entrypoint (`@AGENTS.md` + repo-specific guidance)
├── LICENSE
├── README.md
└── package.json
```

The `skills/<name>/` convention may be refined by ADR-0001 (tracked in [R-133](https://linear.app/rheged-studio/issue/R-133)) once skills.sh's expected layout is double-checked.

## Architecture decisions

ADRs land under `architecture/` as `NNNN-<slug>.md`. ADR-0001 — the foundational decision record for skill layout, distribution conventions, and semver discipline — is forthcoming.

## Contributing

See [AGENTS.md](./AGENTS.md) for estate-wide agent guidance and [CLAUDE.md](./CLAUDE.md) for this repo's conventions (skill layout, `/send-it`, release-please versioning under the dual merge policy).
