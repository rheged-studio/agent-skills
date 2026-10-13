---
title: settle CodeRabbit on its review, not its in-progress placeholder
release_note: triage-pr no longer treats CodeRabbit's "Currently processing" placeholder as a finished review, and rheged-skills-setup maps CodeRabbit to its status check so the review wait ends when CodeRabbit's review does.
created_at: "2026-10-12T21:28:59Z"
merged_at:
branch: a-2755-triage-pr-settles-coderabbit-on-its-in-progress-summary
pr:
commit:
author: rob@rheged.studio
co_authors: []
category: feature
breaking: false
issues:
  - A-2755
stats:
  files_changed:
  loc_added:
  loc_removed:
  commits:
version:
---

## Fixed

- **triage-pr review settle ([A-2755](https://linear.app/rheged-studio/issue/A-2755)).** CodeRabbit edits its sticky summary
  comment into a "Currently processing new changes" placeholder minutes before
  its review exists. Every state of that comment carries CodeRabbit's
  `auto-generated comment` marker, so `review-threads.mjs` counted an unmapped
  `coderabbitai` as reported on the placeholder. Unattended Phase B could then
  post its plan and report before CodeRabbit's findings landed. An in-progress
  marker now vetoes the finished reading, including on a re-review placeholder
  that still carries the previous walkthrough. triage-pr moves to 0.17.3.

## Added

- **rheged-skills-setup CodeRabbit mapping ([A-2755](https://linear.app/rheged-studio/issue/A-2755)).** When a repo has a root
  `.coderabbit.yaml` (or `.yml`) that doesn't set `commit_status: false`, the
  `reviewBotChecks` detector now maps `coderabbitai` to
  `{ "name": "CodeRabbit", "producer": "coderabbitai" }`. triage-pr then settles
  on CodeRabbit's terminal status, not its sticky comment. A consumer that
  already holds a non-empty `reviewBotChecks` map keeps it on reconcile (it is
  treated as a deliberate edit), so add the `coderabbitai` entry by hand there.
  The hardened activity path covers it until then. rheged-skills-setup moves to
  0.15.0.
- **Dogfood config.** This repo's `triage-pr` config now maps `coderabbitai` to
  its `CodeRabbit` status as well as `claude` to `claude-review`.
