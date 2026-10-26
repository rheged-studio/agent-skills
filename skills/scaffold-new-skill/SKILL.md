---
name: scaffold-new-skill
description: >-
  Generate a spec-compliant new-skill skeleton under skills/<name>/ for the
  agent-skills repo, so new bundles start consistent and stop drifting. Use when
  asked to scaffold / create / bootstrap / start a new skill, add a new skill
  bundle, or generate the boilerplate for a skill. Writes a SKILL.md, a
  package.json (@rheged-studio/skill-<name>, private, version 0.1.0), a
  config.json + config.example.json with identical key sets, an entry script
  wired to the standard --help / --dry-run / --self-test dispatch idiom, a vitest
  test stub, and a README — all passing the same pnpm validate:skills gate. Has a
  --dry-run preview and refuses to clobber an existing bundle.
license: MIT
compatibility: >-
  Requires Node.js ≥22 for the bundled generator script. No network access.
metadata:
  version: 0.2.0
  author: Rob Easthope
allowed-tools: Read, Bash(node:*), Bash(pnpm:*)
---

# scaffold-new-skill

A meta-skill that generates a spec-compliant skeleton for a new `skills/<name>/`
bundle. Every artefact it writes satisfies the same rules `pnpm validate:skills`
enforces (ADR-0001, R-364), so a freshly scaffolded skill is valid the moment it
lands — the boilerplate can no longer drift away from the contract by hand.

## Configuration

Two defaults live in [`config.json`](config.json) beside this file:

| Key | Meaning | Default |
| --- | --- | --- |
| `scope` | The npm scope used in the generated `package.json` name (`<scope>/skill-<name>`). | `"@rheged-studio"` |
| `author` | The default author string stamped into the generated `SKILL.md` `metadata.author` and `package.json`. | `"Rob Easthope"` |

A neutral [`config.example.json`](config.example.json) ships alongside as a
template; its key set is identical to `config.json`. Override the author per run
with `--author="…"`.

## What it generates

Given a kebab-case `--name=<name>`, the generator writes:

- `skills/<name>/SKILL.md` — frontmatter with `name: <name>`,
  `metadata.version: 0.1.0`, and `metadata.author`, plus a `## Process` /
  `## Scripts` body skeleton with `TODO` placeholders. It also carries the
  shared `## Untrusted input` section, with placeholder ingestion points to fill
  in or, if the skill reads no outsider-authored text, delete. The wording and
  the reasons for it are in the
  [skill conventions](https://github.com/rheged-studio/agent-skills/blob/main/docs/skill-conventions.md).
- `skills/<name>/package.json` — `name: @rheged-studio/skill-<name>`,
  `private: true`, `version: 0.1.0`, and `repository.directory: "skills/<name>"`.
- `skills/<name>/config.json` + `skills/<name>/config.example.json` — generated
  from one template object, so their **key sets are identical by construction**
  (parity, not a thing to keep in sync by hand).
- `skills/<name>/scripts/<name>.mjs` — a zero-dependency entry script pre-wired
  to the standard `--help` / `--dry-run` / `--self-test` dispatch idiom (R-462),
  with a pure `run()` export and a `isCliEntry()` guard.
- `skills/<name>/README.md` — an install + usage skeleton.
- `tests/skills/<name>/<name>.test.ts` — a vitest stub that imports the entry
  script's `run()` export. It lands in the repo's `tests/` tree (already covered
  by the root vitest glob), so the new skill's tests run with **no config change**.

## Process

1. **Pick a name.** Lower-case kebab-case (`[a-z0-9-]`, no leading/trailing or
   consecutive hyphens, ≤64 chars), matching the directory the bundle will live
   in. The generator rejects anything else before writing.
2. **Preview first.** Run a `--dry-run` to list exactly what would be written and
   confirm the name and paths:

   ```bash
   node skills/scaffold-new-skill/scripts/scaffold.mjs --name=<name> --dry-run
   ```

3. **Generate.** Drop `--dry-run` to write the skeleton. The generator refuses to
   overwrite a `skills/<name>/` that already exists with content, so an
   accidental re-run can't clobber real work:

   ```bash
   node skills/scaffold-new-skill/scripts/scaffold.mjs --name=<name>
   ```

   Pass `--author="…"` to override the default author for this skill.
4. **Verify the gate is green.** The skeleton is built to pass, but confirm:

   ```bash
   pnpm validate:skills && pnpm test
   ```

5. **Fill in the `TODO`s.** Replace the placeholder `description`, body, config
   keys, entry-script logic, and the test stub with the real skill. In
   `## Untrusted input`, list every source of outsider-authored text the skill
   reads, or delete the section if there is none. Bump the
   version in lockstep (`package.json` `version` + `SKILL.md` `metadata.version`)
   as the skill grows, per the repo's by-hand skill-versioning rule.

## Scripts

The bundled [`scripts/scaffold.mjs`](scripts/scaffold.mjs) is a zero-dependency
Node generator. It supports the standard dispatch flags:

- `--help` (alias `-h`) — print usage.
- `--dry-run` — print the files it would write, create nothing.
- `--self-test` — run built-in offline assertions (name validation, that the
  generated skeleton passes the `validate-skills` rules, config/example key
  parity, that the generated `SKILL.md` carries the `## Untrusted input`
  section, that the dry-run path writes nothing, a real write, and the
  clobber-refusal guard) against a temp directory. No network, no writes outside
  the temp dir.
