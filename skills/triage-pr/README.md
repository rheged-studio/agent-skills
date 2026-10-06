# triage-pr

Take a pull request from **draft + failing CI** to **merge-ready**: fix in-scope
CI failures while the PR is a draft, then — by default — promote the cleanly-green
draft to ready (`promoteOnGreen`), wait for AI reviewers, verify-then-propose
dispositions, and — by default (`humanEnvelope: false`) — apply the **unattended**
path (plan comment + act; no Yes/No; no Linear-only prompt). Set
`humanEnvelope: true` to **halt for a human envelope** before applying accepts,
declines, or Linear follow-ups. The envelope uses Cursor’s `AskQuestion` or Claude
Code’s `AskUserQuestion` when available (batch **Yes / No / Other**, **default
yes**), preceded by an Option A disposition-detail summary with available thread or
summary-comment permalinks so you can decide without leaving chat; otherwise
prose `[Y/n]`. `--auto-apply` forces the unattended path for one run.
Opt out of promotion with `--no-promote` (or `promoteOnGreen: false`) to stop at
green for a human to flip; the final merge to the trunk always stays with a human.

When `/send-it` chains into this skill (A-1151) and `humanEnvelope` is `true`, the
run ends on the **same** envelope. Step 12 re-envelopes after new bot findings use
it too. When `humanEnvelope` is `false` (or `--auto-apply`), the chain follows the
unattended path. Exploring the
same Questions pattern for other confirmation skills: [A-1655](https://linear.app/rheged-studio/issue/A-1655).

## Install

From any consumer repo:

```bash
npx skills add https://github.com/rheged-studio/agent-skills --skill triage-pr --agent claude-code --agent cursor --copy
```

`--copy` writes real files so the bundle is portable. Don't use `-g` / `--global`
— the install should live in the consumer repo.

## Configure

This skill ships only [`config.example.json`](config.example.json), a template —
the per-skill `config.json` is generated on install, not vendored. Run the
`rheged-skills-setup` skill to generate `config.json`, or copy the example to
`config.json`, then edit it in your installed copy:

| Key | Meaning | Default |
| --- | --- | --- |
| `reviewBots` | GitHub login names whose comments and threads are treated as first-class AI review feedback (matched on `author.login`; the `[bot]` suffix is normalised). Edit to match your install. `github-actions` is excluded by default. | `["claude", "coderabbitai"]` |
| `reviewBotChecks` | Map from a review bot to the status or check it posts per review (e.g. `{"coderabbitai": "CodeRabbit"}`). A mapped bot settles only when that check is terminal on the current head and post-dates the ready flip; unmapped bots fall back to post-ready activity on the head. | `{}` |
| `maxCiRounds` | Maximum Phase-A re-watch iterations before stopping and reporting blockers. | `5` |
| `maxReviewRounds` | Maximum Phase-B re-review rounds (re-plan or re-envelope after an apply push) before stopping and reporting blockers. | `2` |
| `replyOnAccept` | Whether an **accepted** finding gets a factual thread reply referencing the fixing commit before resolve. | `true` |
| `promoteOnGreen` | Draft→ready flip after proven-green Phase A. **Default-on.** | `true` |
| `deferNonBlocking` | Propose accept only for high-impact in-scope findings (one impact rubric, in `references/review-discipline.md`); otherwise follow-up. Envelope path only — the unattended path always applies the rubric. | `true` |
| `humanEnvelope` | Halt Phase B for a full disposition batch **Yes / No / Other** (**default yes**; structured Questions when available) before applying. **Default-off** (unattended). Set `true` for the envelope; `--auto-apply` forces unattended for one run. | `false` |
| `reviewIdleMinutes` | Hybrid review-settle idle window (minutes). | `10` |
| `reviewWaitMaxMinutes` | Hard cap on waiting for review bots; then slow-bot micro-gate. | `20` |

## Requirements

- `gh` CLI, authenticated (`gh auth status` must pass) — used for checks, logs,
  review threads, and thread resolution.
- `git`.
- Node.js >=22 (ES-module support), for the bundled review-thread fetcher.

## What it does

Two phases, chosen from the PR's draft state:

1. **Phase A — while the PR is a draft.** Inspect failing checks with `gh`, pull
   the failing GitHub Actions logs, and fix failures **in PR scope only** — never
   weakening CI config to greenwash. A failure whose only fix would edit lint
   config or add an ignore directive is classified **gated** and reported for the
   developer's sign-off, never applied. Rebase/merge the base branch when failures
   are upstream drift. Loop until CI is green or report blockers — and stop
   **immediately** once every remaining red check is gated, leaving CI red and
   promotion blocked. Unattended.
2. **Phase B — after the PR is ready-for-review.** Hybrid-wait for configured
   `reviewBots` (sticky headlines and/or threads via `botsReported` /
   `botsMissing`),
   verify-then-propose dispositions, then — by default — **human envelope**
   (Option A detail + structured Yes/No/Other) before applying. Re-envelope when
   new bot findings appear after apply. With `--auto-apply` (or
   `humanEnvelope: false`), post the plan as a PR comment and act — including
   creating Linear follow-ups — with no Linear-only gate.

**By default the skill promotes a cleanly-green draft to ready** and continues into
Phase B. Promotion is gated on proven-green CI, no unresolved human review threads,
and no unresolved base drift. Merge to `main` stays a human action.

The review-discipline rules folded into Phase B (verify before implementing, no
sycophancy, evidence before claims, human envelope) live in
[`references/review-discipline.md`](references/review-discipline.md).
