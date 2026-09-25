---
title: rheged-skills-setup
description: Install the estate skill catalogue and reconcile per-skill config.json from repo facts — base branch, package roots, changelog dir, Linear keys, review bots. Use --install to vendor Rheged + Matt Pocock packs; dry-run first, idempotent, never clobbers deliberate edits.
allowed-tools: Read, Bash(node:*), Bash(git:*), Bash(npx:*), mcp__linear-server__list_teams, mcp__linear-server__get_team
---

Rheged skills setup for this repo. Follow the
[`rheged-skills-setup` skill](../../skills/rheged-skills-setup/SKILL.md) end to end.

- **Estate install:** `node skills/rheged-skills-setup/scripts/initialise.mjs --install` (preview), then `--install --write` after confirmation.
- **Reconcile only:** dry run → Linear facts → confirm → `--write` (see the skill's Process section).

In this repo Rheged bundles live under `skills/`; Matt packs vend into `.claude/skills/` and `.agents/skills/` via `--install`.

## Arguments

$ARGUMENTS
