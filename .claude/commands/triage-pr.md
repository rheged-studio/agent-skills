---
title: triage-pr
description: Drive a pull request from draft with failing CI to merge-ready — fix in-scope CI failures, then Phase B AI review dispositions (unattended by default).
allowed-tools: AskUserQuestion, Read, Edit, Write, Glob, Grep, Bash(gh:*), Bash(git:*), Bash(node:*), Bash(pnpm:*), Bash(npx:*)
---

Take the current branch's pull request from **draft + failing CI** to
**merge-ready**. This is the standalone entry point for the [`triage-pr`
skill](../../skills/triage-pr/SKILL.md) — follow that skill's two-phase process
(Phase A fixes in-scope CI failures while the PR is a draft; Phase B
verify-then-propose dispositions and, by default, applies the **unattended** path
once it is ready; set `humanEnvelope: true` for the human envelope), with the
constraints below.

**Relationship to `/send-it`:** since send-it 0.8.0, `/send-it` **opens or updates**
the PR and then **invokes this skill as its Step 11** (A-1151). A default send-it
run is incomplete until that hand-off happens. Running `/triage-pr` directly is for
mid-flight re-entry (or when send-it was skipped), not the normal end of send-it.

## Process

1. Read the skill's [`config.json`](../../skills/triage-pr/config.json) for
   `reviewBots`, `maxCiRounds`, `replyOnAccept`, `promoteOnGreen`,
   `humanEnvelope`, and related knobs.
2. Follow the skill's Steps 1–13: locate the PR and detect its phase, inspect and
   classify failing checks (in-scope vs base drift vs lint-surface **gated**), fix
   in-scope failures one at a time **without weakening any gate** — never editing lint
   config or adding an ignore directive on your own initiative; classify those as gated
   and report them for the developer's sign-off — re-watch CI (bounded by `maxCiRounds`),
   then — once the PR is ready — hybrid-wait for reviewers, fetch review feedback
   (`node skills/triage-pr/scripts/review-threads.mjs <pr> --bots "<reviewBots>"`),
   verify-then-propose a disposition plan, and — when `humanEnvelope` is on — present
   the **Option A detail block** plus a structured **Yes / No / Other** gate
   (`AskUserQuestion` here; Cursor uses `AskQuestion` when available; else prose
   `[Y/n]`, **default yes**) before applying. After each apply push, **loop back** —
   a push re-fires both CI and AI review — and **re-envelope** (same Questions
   contract) if new bot findings appear, until CI is green and no unresolved AI
   threads remain. **In Phase A**, every remaining red being a lint-surface
   **gated** item ends the phase immediately (CI stays red, so promotion is
   blocked). Do **not** claim the run is done while any required check is still
   non-terminal; alert the human only at a natural stopping point (Step 13, a
   documented Step 6 Phase-A early stop, the envelope, or a hard blocker / budget
   exhaustion).
3. **The draft → ready flip is governed by `promoteOnGreen`** (read in step 1) — the
   single control for it. When `true` (the default), an enabled config _is_ the
   authorisation: once Phase A is proven-green (no unresolved human threads, no base
   drift), flip the PR to ready (the gate that turns AI review on) and continue into
   Phase B — don't stop to seek a separate human sign-off. When `false`, stop at green.
   An explicit user prompt, or `--promote` / `--no-promote`, overrides per run. Merge to
   `main` stays the human's call.

## Flags

- `--promote` / `--no-promote` — override the `promoteOnGreen` config for this run:
  force the draft→ready flip on a cleanly-green Phase A, or force stop-at-green.
- `--auto-apply` / `--ci-only` — skip the human envelope (legacy auto Phase B) or run
  Phase A only, even if the PR is ready.
- `--dry-run` — report failing checks and unresolved findings and propose the
  disposition plan, but change nothing (no commits, pushes, thread replies, or
  question-tool apply).

## Notes

- Run the bundled fetcher from the repo root:
  `node skills/triage-pr/scripts/review-threads.mjs`. The `--bots` value is
  `config.reviewBots` joined by commas.
- The fetcher returns unresolved / deferred / human threads plus `aiSummaryComments`
  (sticky issue-level review summary). Thread objects include `url` when GitHub
  provides a comment permalink — use it in the envelope detail block.
- Only the configured `reviewBots` are actioned; human review comments are
  surfaced in the report but never auto-actioned.
- `/send-it` opens or updates the PR and then invokes this skill as Step 11
  (same structured Questions envelope UX); use `/triage-pr` directly for
  mid-flight re-entry, not as the normal end of send-it.

## Arguments

$ARGUMENTS
