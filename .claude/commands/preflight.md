---
description: Run change-gated, branch-scoped lint preflight on the current branch and report — no commits, changelog, push, or PR.
allowed-tools: Read, Bash(git:*), Bash(pnpm:*), Bash(node:*), mcp__linear-server__save_issue, mcp__linear-server__list_issue_statuses, mcp__linear-server__list_projects
---

# Preflight

Run the standalone lint preflight for the current branch and report the result.
This is the deterministic entry point for the [`preflight`
skill](../../skills/preflight/SKILL.md) — follow that skill's loop, with the
standalone constraints below.

Standalone means: **report and optionally auto-fix, but do not commit, write a
changelog, push, or open a PR.** Any fixes are left in the working tree for the
user to review and commit themselves.

## Process

1. Fetch the base branch so the diff is accurate: `git fetch origin <base>` (the
   base is auto-detected; default `main`).
2. Run `node skills/preflight/scripts/preflight.mjs`.
3. Read `.preflight-summary.json` and report the categories run and the violation
   counts. When `lintSurface.count > 0`, list its `configFiles` and `directives`
   as **developer decisions** to confirm — informational, never blocking (see the
   skill's "Lint surfaces are a developer decision").
4. Act on the exit code (per the preflight skill):
   - **Exit 0** — report "preflight passed", with the categories run and counts.
     Done.
   - **Exit 1 (introduced violations, or a linter that failed to run)** — run
     `node skills/preflight/scripts/lint-fix.mjs`, re-run
     `node skills/preflight/scripts/preflight.mjs`, and repeat until introduced
     violations clear or the user stops. Fix the code — never clear a violation
     with a lint-config edit or an ignore / disable directive; if that is the only
     fix, stop and report it instead. Leave the fixes **unstaged** in the
     working tree; tell the user what was fixed and that they should review and
     commit. If a linter failed to run rather than reporting violations, surface
     its stderr instead of looping.
   - **Exit 2 (pre-existing violations only)** — show the list and ask: fix now
     (leave fixes in the working tree), or defer to a Linear debt issue per the
     preflight skill's **Debt-issue create** contract (`linearTeamName` +
     `debtProject` in root `preflight.config.json`; refuse create without a
     resolved project). Do not block on shipping — there is nothing to ship here.

## Flags

- `--dry-run` — run `node skills/preflight/scripts/preflight.mjs --dry-run`: report
  the categories and scoped file lists only, without classifying violations or
  auto-fixing. Exit 0.

## Notes

- Scope is `origin/<base>...HEAD` changed paths only — not a whole-repo
  `pnpm lint`.
- This command covers the **lint** gate only. The changelog entry and its
  validation are part of a ship flow (e.g. `/send-it`), not this command.
- Configuration (linted workspaces, base branch) is auto-detected; see the
  preflight skill for the optional repo-root `preflight.config.json` override.
