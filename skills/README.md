# Skills

Each skill lives in `skills/<name>/` as a [skills.sh](https://skills.sh)-compatible bundle with a `SKILL.md` manifest at its root.

Consumers install a skill from this repo with:

```bash
npx skills add https://github.com/rheged-studio/agent-skills --skill <name> --agent claude-code --agent cursor --copy
```

Pass `--skill` more than once (or omit it to install them all), and add an `--agent` for each agent you want the bundle installed into.

## Available skills

| Skill | What it does |
| --- | --- |
| [`changelog`](changelog/SKILL.md) | Author, refresh, or repair the current branch's dated changelog entry, run the enrichment scripts, and validate it against the changelog contract. |
| [`cleanup-repo`](cleanup-repo/SKILL.md) | Clean up merged Git branches and worktrees, then prune filesystem cruft, behind a single confirmation gate. |
| [`commit`](commit/SKILL.md) | Turn the working tree into logical, atomic Conventional Commits — classify files in-scope vs out-of-scope against the merge base, show a staging plan, and never `git add -A`. Commits only. |
| [`rheged-skills-setup`](rheged-skills-setup/SKILL.md) | Install the estate catalogue (`--install`) and reconcile each installed skill's `config.json` with detected facts (base branch, package roots, changelog dir, Linear keys). |
| [`linear-sync`](linear-sync/SKILL.md) | Transition the Linear issue(s) linked to the current branch to a target workflow state. |
| [`preflight`](preflight/SKILL.md) | Run a change-gated, branch-scoped lint preflight (ESLint / markdownlint / actionlint) and classify each violation as introduced vs pre-existing. |
| [`send-it`](send-it/SKILL.md) | The all-in-one ship pipeline: commit, lint, changelog, Conventional Commits PR title, push, open/update the PR, move linked Linear issues to In Review, then chain into `triage-pr` (Step 11). |
| [`triage-pr`](triage-pr/SKILL.md) | Drive a pull request from draft-with-failing-CI to merge-ready — fix in-scope CI failures, then action unresolved AI review feedback. |

The orchestrator skills delegate to siblings: `send-it` uses `commit`, `preflight`,
`changelog`, `linear-sync`, and `triage-pr`, so install those alongside it (the
`send-it` skill's `compatibility` block names the siblings it delegates to; the
other bundles' `compatibility` blocks list only their infrastructure requirements).

## Supported agents

These bundles are the open [Agent Skills](https://github.com/vercel-labs/skills) format (`SKILL.md` + YAML frontmatter), so [skills.sh](https://skills.sh) installs the **same** bundle into any of its 70+ supported agents. We officially target **Claude Code** and **Cursor**; the others (Codex, Cline, Windsurf, Copilot, Continue, Zed, Gemini CLI, OpenCode, …) install cleanly with no extra infrastructure. The only Claude-specific frontmatter is the `allowed-tools` key itself (with values like `mcp__linear-server__*` and `Bash(gh:*)`); other agents ignore unknown frontmatter, and each skill's `compatibility` block documents the underlying `gh` / Linear-MCP requirements regardless of agent.
