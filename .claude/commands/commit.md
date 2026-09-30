---
description: Turn the working tree into logical, atomic Conventional Commits with an out-of-scope guard — no push, PR, changelog, or Linear writeback.
allowed-tools: Read, Bash(git:*)
---

# Commit

Turn whatever is uncommitted into logical, atomic Conventional Commits. This is
the standalone entry point for the [`commit`
skill](../../skills/commit/SKILL.md) — follow that skill's contract, with the
standalone constraints below.

Standalone means: **create the commits on the current branch and stop — do not
push, write a changelog, open a PR, or touch Linear.** Files that look like they
belong to another branch or worktree are flagged and never staged.

## Process

1. `git status --porcelain`. If clean, say there's nothing to commit and stop.
2. Classify uncommitted files **in-scope vs out-of-scope** against the merge base
   (`git merge-base HEAD origin/<base>`; `<base>` is `baseBranch` from
   `config.json`, default `main`) — per the commit skill's Process.
3. Show the staging plan: in-scope files grouped by proposed commit, plus any
   out-of-scope files flagged as "uncertain — possibly from another
   branch/worktree." Ask before staging.
4. On confirmation, create one **logical atomic** commit per coherent unit with a
   Conventional Commits subject (`git add <specific files>`, **never** `git add
   -A`; `git commit -m …`). Out-of-scope files stay untouched in the working tree.

## Notes

- Group by **intent**, not component/package boundaries (per-component splitting
  is parked — A-374).
- Author commit prose in the repo's documented language (British English across
  this estate); mark breaking changes honestly with `!` / `BREAKING CHANGE:`.
- Keep each Conventional Commits header (the entire first line) at or under 72
  characters; see the commit skill for the counting rules.
- This command commits only. The lint gate, changelog, push, PR, and Linear
  transition are part of a ship flow (e.g. `/send-it`), not this command.
