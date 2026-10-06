---
title: send-it
description: Bundle uncommitted work, run the lint preflight, write a dated changelog entry, set a Conventional Commits PR title, push the branch, open or update a PR, move linked Linear issues to In Review, then chain into triage-pr to drive the PR to merge-ready.
allowed-tools: Write, Read, Edit, Glob, Grep, Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(node:*), Bash(npx:*), mcp__linear-server__get_issue, mcp__linear-server__save_issue, mcp__linear-server__list_issue_statuses, mcp__linear-server__list_projects
---

The all-in-one ship pipeline for this repo. This is the entry point for the
[`send-it` skill](../../skills/send-it/SKILL.md) — follow that skill end to end.

**Done criteria:** the run is incomplete until Step 11 (`triage-pr`) has run, or
you printed an explicit skip/degraded line with a stated reason
(`ℹ️ triage chain skipped …` or `⚠️ triage-pr not installed …`). Opening a draft
PR alone is mid-pipeline, not finished.

It bundles uncommitted work into atomic commits, runs the change-gated lint
[`preflight`](../../skills/preflight/SKILL.md), authors or updates the dated
`changelog/<ts>-<slug>.md` entry (via the
[`changelog`](../../skills/changelog/SKILL.md) skill), composes a **Conventional
Commits PR title** (CI + humans; feature PRs land as merge commits and
release-please ranks landed commit subjects for the bump — A-1176), pushes the
branch, opens or updates a PR against `main`, and transitions linked Linear issues
to **In Review** (via the [`linear-sync`](../../skills/linear-sync/SKILL.md) skill).

It then **chains into [`triage-pr`](../../skills/triage-pr/SKILL.md)** (Step 11) to
drive the PR to merge-ready: the Phase A CI fix loop, the promote-on-proven-green
flip, then Phase B through triage-pr (unattended by default — Step 13 report when
`humanEnvelope` is `false`). So a default run is unattended for roughly 30 minutes
and ends on triage-pr's closing report, not a `[y/N]` prompt. `--skip-triage`
ends the run at the open PR instead.

## Process

Follow the `send-it` skill's steps. It reads
[`skills/send-it/config.json`](../../skills/send-it/config.json) for the
shippability decision — for this repo, `shippablePaths: ["skills/"]` and
`shippableManifestKeys: ["name", "version", "files", "publishConfig"]`, base branch
`main`. The team name / issue keys for the Linear and changelog steps come from the
respective sibling skills' `config.json` files.

Repo specifics that fall out of the skill's config here:

- **Shippable** = any change under `skills/`, or a `package.json` change to `name` /
  `version` / `files` / `publishConfig` → a release-triggering `feat`/`fix`/`feat!`
  title. Everything else (docs, `.github/`, `infrastructure/`, `.claude/`,
  `architecture/`, the dated `changelog/` itself, release-please config, a lone
  lockfile bump) is non-shippable → a non-release type (`docs:`/`chore:`/`ci:`/…).
- A skill's own `package.json` / `SKILL.md` `metadata.version` bump lives under
  `skills/`, so it **is** shippable when the skill content changes alongside it.
- This repo sets `bundleVersioning` in the skill's `config.json`, so Step 6 runs the
  per-bundle version-bump check: if a `skills/<name>/` bundle changed but its version
  didn't, send-it proposes a bump and (on confirmation) edits its `package.json`
  `version` + `SKILL.md` `metadata.version` in lockstep before composing the title.
- The single published package is the root `@rheged-studio/agent-skills`; the PR
  title always describes it (published surface `files: ["skills/"]`, ADR-0002).

This command intentionally does NOT run typecheck, tests, or format checks — CI
handles those. The only gate it runs is the change-gated `preflight` lint.

## Flags

- `--dry-run` — preview the changelog entry, branch, and conventional PR title; make
  no commits and no push. Chains into `triage-pr --dry-run` when a PR already exists,
  so it makes read-only `gh` calls. Exit 0.
- `--branch=<name>` — override the auto-derived branch name when on `main` with
  uncommitted changes.
- `--issue=<ID>` — prefix the auto-derived slug with a Linear issue ID (e.g.
  `--issue=ASW-7` → `asw-7-<slug>`, lower-cased). Ignored if `--branch` is given.
- `--base=<branch>` — override the `main` base for this run (stacked PRs / non-`main`
  targets); applies to the fetch, the branch diff, and the PR base.
- `--title="<conventional subject>"` — set the PR title verbatim instead of deriving
  it (must stay a valid Conventional Commits subject — CI lints it; warn if it
  exceeds 72 characters).
- `--skip-preflight` — skip the lint gate entirely (prints a bypass warning).
- `--skip-triage` — end the run at the open PR; skip the Step 11 `triage-pr` chain.
  Not a shortcut — see Step 11 for the narrow cases where it applies, and say why in
  the report.
- `--ci-only` / `--no-promote` / `--auto-apply` — forwarded verbatim to `triage-pr`;
  no effect on send-it's own steps.
- `--ready` — open the PR ready-for-review instead of draft (default is draft).
- `--worktree=<branch-or-path>` — `cd` into a worktree before running. Resolved via
  `git worktree list --porcelain`; errors if it matches no worktree.

`--merge-when-ready` was removed in send-it 0.8.0 — send-it no longer arms
auto-merge, so a chained triage run can't land the PR while its disposition plan is
still awaiting approval. Merging stays a human action.

## Arguments

$ARGUMENTS
