---
title: Harden the changelog skill's frontmatter parser, link masking and affected-packages guard
release_note: The changelog skill's bundled scripts now fail loudly on an unterminated quoted inline-array item, ignore blank lines inside block arrays (including one before the first item) instead of emitting spurious null entries or aborting, treat an all-whitespace block scalar as empty rather than silently collapsing it, mask reference-style Markdown link labels and their definition lines so re-running the linkifier stays idempotent, refuse to overwrite an entry whose frontmatter failed to parse, and name the offending file when a frontmatter parse error aborts the branch lookup.
created_at: '2026-06-25T20:11:56Z'
merged_at: '2026-06-25T21:19:15Z'
branch: sk-391-close-post-merge-bot-review-findings-from-pr-21-changelog
pr: 39
commit: c1f364e
merge_strategy: squash
author: rob@acmeskunkworks.io
co_authors: []
category: fix
breaking: false
issues:
  - R-391
affected_packages:
  - changelog
  - infrastructure
stats:
  files_changed: 9
  loc_added: 475
  loc_removed: 86
  commits: 6
version: 1.2.0
---

## Fixed

- **Unterminated quoted inline-array items now throw.** `splitInlineItems` in
  `frontmatter.mjs` previously pushed the final item unconditionally, folding a
  dangling opening quote into the parsed value (e.g. `co_authors: ["Smith, Jr.]`
  was silently accepted). It now throws a clear `Unterminated quoted item in
  inline array` parse error.
- **Blank lines inside a block array no longer produce `null` entries.** Interior
  blank lines are filtered before mapping, so a YAML block sequence with gaps
  between items parses as the list of items rather than `["a", null, "b"]`.
- **A blank line before the first block-array item no longer aborts the parse.**
  `parseMapping` now chooses array-vs-mapping from the first _non-blank_ block
  line, so `key:` followed by a blank line and then `- item` parses as a list
  instead of throwing `Invalid frontmatter line`.
- **All-whitespace block scalars no longer collapse silently.** `parseBlockScalar`
  treated only a zero-length block as empty; a block whose lines were all
  whitespace produced `Math.min(...[]) === Infinity` and sliced every line down to
  `""`. It now treats an all-whitespace block the same as an empty one and returns
  `""`, leaving normal blocks untouched.
- **Reference-style Markdown links — and their definition lines — are masked in
  `add-links.mjs`.** The already-linked guard only matched inline links
  (`[text](url)`), so reference-style labels like `[R-123][1]` and `[R-123][]`,
  and the companion definition line `[R-123]: <url>` (including the CommonMark
  form indented up to three spaces), were rewritten inside, corrupting on every
  re-run. All are now masked alongside inline links, keeping the linkifier
  idempotent.
- **`set-affected-packages.mjs` refuses a destructive overwrite.** When
  `parseFrontmatter` yields empty data (or data lacking the `branch` key) the script
  now throws before writing, rather than silently overwriting the entry with only
  `affected_packages`.
- **Frontmatter parse errors name the offending file.** `findEntryByBranch` wraps
  the per-entry parse in a try/catch and rethrows with the entry path, so a
  malformed entry anywhere in `changelog/` is easy to locate.

## Added

- **Regression tests for every fix** under `infrastructure/tests/` —
  `changelog-frontmatter.test.ts` (parser edge cases including the blank-first
  block array, the affected-packages guard, and the named-file parse error) and
  `add-links-reference-masking.test.ts` (reference-style label and definition-line
  masking, and idempotency), importing the bundled `.mjs` modules directly.
