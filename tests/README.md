# Root-level skill-bundle tests

This folder holds behavioural tests for the **bundled skill scripts** — the
zero-dependency `.mjs` modules that ship inside `skills/<name>/scripts/`.

## Why the tests live here, not in the bundle

Each skill is published as a drop-in skills.sh bundle. To keep that bundle clean
we deliberately do **not** ship `*.test.mjs` files alongside the scripts — a
consumer who installs the skill gets the runtime scripts and nothing else. The
tests therefore live at the repo root and import the bundled `.mjs` modules
directly:

```ts
import { rewriteBody } from "../../../skills/changelog/scripts/add-links.mjs";
```

Because the import path reaches straight into `skills/<name>/scripts/`, the
published bundle stays test-free whilst the scripts are still exercised in CI
(the `🔬 Build & Lint` job runs `pnpm test`, which is `vitest run`).

## Layout

```text
tests/
  README.md
  lib/                # tests for the canonical repo-root lib/*.mjs
  skills/
    changelog/        # tests for skills/changelog/scripts/**/*.mjs
    <name>/           # future bundled-script skills add their tests here
```

`tests/lib/` covers the canonical repo-root `lib/` modules (ADR-0004). Some
are vendored into bundles; others (`lib/linear-states.mjs`) exist only to pin
the rules that script-less skills such as `linear-sync` describe in prose.

A future bundled-script skill (`linear-sync`, say, were it ever to grow scripts)
adds its tests under `tests/skills/<name>/`, importing that skill's bundled
`.mjs` the same way.

## Conventions

- Tests are vitest `*.test.ts` files (picked up by the `tests/**/*.test.ts`
  glob in `vitest.config.ts`, alongside `infrastructure/tests/**`).
- Import the bundled `.mjs` under test directly; never copy it.
- Keep tests deterministic — use `node:os` `tmpdir()` + `node:fs` for any
  filesystem fixtures, and clean them up.
- These tests complement, rather than duplicate, the `infrastructure/tests/`
  suite. Some changelog modules already have bundle-level coverage there
  (`config.mjs`, `derive-packages.mjs`, plus `frontmatter.mjs` /
  `add-links.mjs` / `set-affected-packages.mjs` edge cases); this folder fills
  the broad behavioural gaps without re-running those.

## Note on `validate-changelog.mjs`

Since R-369 the bundled `validate-changelog.mjs` is the single authored
validator: it exports a pure `validateEntry(name, raw)` and guards its CLI
walk behind an `import.meta` check, so it is imported directly for unit testing.
Its field-type and schema rules are covered in
`infrastructure/tests/validate-changelog.test.ts` (which imports the bundle).
