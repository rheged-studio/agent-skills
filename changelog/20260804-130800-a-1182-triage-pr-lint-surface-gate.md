---
title: triage-pr gates lint-config and lint-ignore changes on developer sign-off
release_note: triage-pr no longer edits lint configuration or adds ignore directives on its own initiative — a failure whose only remedy touches a lint surface is classified gated, reported at the existing stopping points, and left for the developer to decide.
created_at: '2026-08-04T13:08:00Z'
merged_at: '2026-08-04T13:25:23Z'
branch: a-1182-triage-pr-lint-surface-gate
pr: 152
commit: 2ab5353
author: rob@acmeskunkworks.io
co_authors: []
category: feature
breaking: false
issues:
  - R-1182
stats:
  files_changed: 6
  loc_added: 251
  loc_removed: 20
  commits: 6
version: 1.4.0
---

## Added

- **Lint-surface gate (rule, not a knob — [R-1182](https://linear.app/rheged-studio/issue/R-1182)).**
  A lint / format / static-analysis failure whose only available remedy is a
  **config change** or a new **ignore / disable directive** is now classified
  **gated** in Step 3 — beside in-scope and upstream — and the agent does not make
  it. Phase A carries on fixing everything else and reports gated items at the
  natural stopping points (the Step 6 Phase-A early stop, the Step 13 report), each
  naming the file, the change that would have been made, and the preferred
  alternative. No mid-loop prompt, so Phase A stays unattended.

- **Preference order in Step 4.** Fix the offending **code** first; if the rule
  itself is wrong, propose the change in the **shared config package**
  (`@acme-skunkworks/eslint-config`, `@acme-skunkworks/markdownlint-config`, …); a
  local override or ignore only with the developer's sign-off. A carve-out lets the
  agent repair a genuine error in a developer-authored lint config already in the
  PR's diff — but never loosen a rule or widen an ignore.

- **Phase B rides the existing envelope.** A finding whose fix would touch a lint
  surface is proposed as `[gated]` in the Step 9 disposition plan and shown inside
  the Step 10 `humanEnvelope` batch — no second prompt. Step 11 applies it only on
  explicit approval; a fix that turns out mid-apply to need a lint-surface change is
  stopped and re-presented in the Step 12 re-envelope. Under `--auto-apply` the item
  is reported, never auto-applied.

- **Surface list and grey-zone guidance** in
  `skills/triage-pr/references/review-discipline.md`: the config globs
  (`eslint.config.*`, `.eslintrc*`, `.markdownlint*`, `.yamllint*`, `.prettierrc*`,
  `.shellcheckrc`, actionlint config, shared-config extends, CI severity knobs) and
  the ignore directives (`eslint-disable*`, `markdownlint-disable`,
  `# yamllint disable`, `prettier-ignore`, `shellcheck disable=`, file-level ignore
  lists), plus what to report and the developer-authored carve-out.

## Changed

- **Important rules** now pairs the hard ban with the grey zone: **Never greenwash**
  (weakening a gate purely to pass CI) stands unchanged, and **Lint surfaces are a
  developer decision** covers everything else that touches a lint surface.
- triage-pr bundle `0.9.1` → `0.10.0`.
