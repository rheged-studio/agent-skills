// Imports the helper directly (the distributed `.mjs`). Covers the pure
// wipe-detection (R-464): which target-repo files the fleet-wipe step would
// remove (canonical command shims) versus only flag for manual review (skill
// dirs sharing a canonical name). The same assertions back the script's
// `--self-test`; this wires them into CI. Deletion (`--apply`) is exercised by
// the self-test, not here.
import { detectWipe } from "../scripts/fleet-wipe.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("detectWipe", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "fleet-wipe-test-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  function write(rel: string, body = "") {
    const full = join(directory, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }

  it("detects canonical command shims and ignores non-canonical command files", () => {
    write(".claude/commands/send-it.md", "# bespoke");
    write(".claude/commands/preflight.md", "# bespoke");
    write(".claude/commands/notes.md", "# not a skill");

    const { shims } = detectWipe(directory);
    expect(shims).toEqual([
      ".claude/commands/preflight.md",
      ".claude/commands/send-it.md",
    ]);
  });

  it("lists canonically-named skill dirs as review candidates, not arbitrary ones", () => {
    mkdirSync(join(directory, ".agents/skills/preflight"), { recursive: true });
    mkdirSync(join(directory, ".claude/skills/changelog"), { recursive: true });
    mkdirSync(join(directory, ".agents/skills/local-thing"), {
      recursive: true,
    });

    const { candidates } = detectWipe(directory);
    expect(candidates).toEqual([
      ".agents/skills/preflight",
      ".claude/skills/changelog",
    ]);
  });

  it("reports nothing for a repo with no shims or skill dirs", () => {
    expect(detectWipe(directory)).toEqual({ candidates: [], shims: [] });
  });
});
