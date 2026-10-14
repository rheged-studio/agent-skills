---
title: Drop bundleVersioning from the send-it config example so single-package consumers reconcile clean
release_note: send-it's config.example.json no longer ships a bundleVersioning key. It is a multi-bundle-only, opt-in control added by hand, so carrying it in the single-package template forced every consumer to hand-strip it on reset and made initialise-skills report it needs-manual-input on every run (the dry-run never reaching 'all clean'). The skill-bundle key-parity check now exempts a config-only optional subtree (bundleVersioning) when the example omits the top-level key wholesale, so agent-skills' own config.json can keep it while the example stays neutral; a partially-present block is still flagged.
created_at: '2026-06-27T21:27:17Z'
merged_at: '2026-06-27T22:07:02Z'
branch: a-555-send-it-example-bundleversioning
pr: 69
commit: 8726fe5
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-555
stats:
  files_changed: 6
  loc_added: 106
  loc_removed: 5
  commits: 2
version: 1.2.0
---

## Fixed

- **`bundleVersioning` removed from `send-it/config.example.json` ([R-555](https://linear.app/rheged-studio/issue/R-555)).**
  `bundleVersioning` is an opt-in control only multi-bundle repos use (it is added by
  hand per the `initialise-skills` SKILL.md step), but the example is the single-package
  default template. Shipping it there meant a consumer resetting `config.json` from the
  example carried a bogus `bundleVersioning: {root: "packages"}` to hand-strip, and —
  because it was in the example key set — `initialise-skills` flagged it
  `needs-manual-input` on every run, so the dry-run never reached "all clean". The
  example now omits it, which also makes `references/detectable-keys.md`'s "isn't in
  send-it's `config.example.json`" claim accurate again. Bundled as `send-it@0.3.5`.

## Changed

- **`validate-skills` key-parity check exempts config-only optional subtrees.** A
  top-level key in `OPTIONAL_CONFIG_ONLY_TOPLEVEL` (currently `bundleVersioning`) may
  live in `config.json` without appearing in `config.example.json` — so agent-skills'
  own multi-bundle `send-it/config.json` keeps it while the template stays neutral
  (preserving the [R-538](https://linear.app/rheged-studio/issue/R-538) parity invariant for every other key). The exemption applies to
  the whole subtree **only when the example omits the top-level key entirely**; a
  partially-present block (some sub-keys present, others not) is still a genuine mismatch
  and stays flagged.
