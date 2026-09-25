// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the .gitignore
// reconcile (A-569): the append-only, idempotent edit that excludes preflight's
// `.preflight-summary.json` scratch output from a consumer repo. Uses a tmp repo
// root so assertions don't depend on the host repo's own .gitignore.
import {
  IGNORE_COMMENT,
  IGNORE_ENTRY,
  reconcilePreflightIgnore,
  stripSkillConfigIgnores,
} from "../../../skills/rheged-skills-setup/scripts/lib/gitignore.mjs";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("reconcilePreflightIgnore", () => {
  let directory: string;

  function ignorePath() {
    return join(directory, ".gitignore");
  }

  function read() {
    return readFileSync(ignorePath(), "utf8");
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "preflight-gitignore-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("creates .gitignore with the entry when none exists", () => {
    expect(reconcilePreflightIgnore(directory, { write: false }).status).toBe(
      "would-create",
    );

    const result = reconcilePreflightIgnore(directory, { write: true });
    expect(result.status).toBe("created");
    expect(read()).toBe(`${IGNORE_COMMENT}\n${IGNORE_ENTRY}\n`);
  });

  it("appends the entry to an existing .gitignore, preserving prior content", () => {
    writeFileSync(ignorePath(), "node_modules/\ndist/\n");

    expect(reconcilePreflightIgnore(directory, { write: false }).status).toBe(
      "would-add",
    );

    const result = reconcilePreflightIgnore(directory, { write: true });
    expect(result.status).toBe("added");
    const text = read();
    expect(text.startsWith("node_modules/\ndist/\n")).toBe(true);
    expect(text).toContain(IGNORE_COMMENT);
    expect(text.endsWith(`${IGNORE_ENTRY}\n`)).toBe(true);
  });

  it("adds a trailing newline before appending when the file lacks one", () => {
    writeFileSync(ignorePath(), "node_modules/");

    reconcilePreflightIgnore(directory, { write: true });
    const text = read();
    expect(text).toBe(`node_modules/\n\n${IGNORE_COMMENT}\n${IGNORE_ENTRY}\n`);
  });

  it("handles an existing but empty .gitignore (no leading blank line)", () => {
    writeFileSync(ignorePath(), "");

    const result = reconcilePreflightIgnore(directory, { write: true });
    expect(result.status).toBe("added");
    expect(read()).toBe(`${IGNORE_COMMENT}\n${IGNORE_ENTRY}\n`);
  });

  it("preserves CRLF line endings on append", () => {
    writeFileSync(ignorePath(), "node_modules/\r\ndist/\r\n");

    reconcilePreflightIgnore(directory, { write: true });
    // The appended block round-trips as CRLF — no bare-LF line slips in.
    expect(read()).toBe(
      `node_modules/\r\ndist/\r\n\r\n${IGNORE_COMMENT}\r\n${IGNORE_ENTRY}\r\n`,
    );
  });

  it("is idempotent — a second write leaves the file byte-identical", () => {
    reconcilePreflightIgnore(directory, { write: true });
    const after1 = read();

    const result = reconcilePreflightIgnore(directory, { write: true });
    expect(result.status).toBe("present");
    expect(read()).toBe(after1);
  });

  it("reports 'present' (no write) when the entry already exists", () => {
    writeFileSync(ignorePath(), `# notes\n${IGNORE_ENTRY}\n`);

    const result = reconcilePreflightIgnore(directory, { write: false });
    expect(result.status).toBe("present");
    // Dry-run must not mutate.
    expect(read()).toBe(`# notes\n${IGNORE_ENTRY}\n`);
  });

  it("treats the leading-slash anchored form as already present", () => {
    writeFileSync(ignorePath(), `/${IGNORE_ENTRY}\n`);
    expect(reconcilePreflightIgnore(directory, { write: true }).status).toBe(
      "present",
    );
  });

  it("reports an explicit !-unignore as 'negated', leaving it untouched (A-582, A-613)", () => {
    // Appending a positive rule after a deliberate negation would, under
    // last-match-wins, silently re-ignore the file the consumer chose to track.
    // The status is distinct from 'present' so it doesn't read as "already
    // ignored" when the file is in fact deliberately un-ignored (A-613).
    const original = `node_modules/\n!${IGNORE_ENTRY}\n`;
    writeFileSync(ignorePath(), original);
    expect(reconcilePreflightIgnore(directory, { write: false }).status).toBe(
      "negated",
    );
    const result = reconcilePreflightIgnore(directory, { write: true });
    expect(result.status).toBe("negated");
    expect(read()).toBe(original);
  });

  it("treats the anchored !-unignore form as 'negated' too", () => {
    writeFileSync(ignorePath(), `!/${IGNORE_ENTRY}\n`);
    expect(reconcilePreflightIgnore(directory, { write: true }).status).toBe(
      "negated",
    );
  });

  it("honours last-match-wins: a positive rule after a negation reports 'present' (A-613)", () => {
    // The un-ignore is overridden by a later ignore rule, so the file IS ignored.
    writeFileSync(ignorePath(), `!${IGNORE_ENTRY}\n${IGNORE_ENTRY}\n`);
    expect(reconcilePreflightIgnore(directory, { write: true }).status).toBe(
      "present",
    );
  });
});

describe("stripSkillConfigIgnores (A-812)", () => {
  let directory: string;

  function ignorePath() {
    return join(directory, ".gitignore");
  }

  function read() {
    return readFileSync(ignorePath(), "utf8");
  }

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "skill-config-gitignore-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("strips .claude/.agents skill-config patterns and the comment block", () => {
    writeFileSync(
      ignorePath(),
      [
        "node_modules/",
        "",
        "# Per-skill agent-skills config.json is generated by the initialise-skills skill,",
        "# not committed (agent-skills v1.1.0 generated-config model, A-640).",
        ".claude/skills/*/config.json",
        ".agents/skills/*/config.json",
        "",
      ].join("\n"),
    );

    expect(stripSkillConfigIgnores(directory, { write: false }).status).toBe(
      "would-strip",
    );

    const result = stripSkillConfigIgnores(directory, { write: true });
    expect(result.status).toBe("stripped");
    expect(read()).toBe("node_modules/\n");
    expect(result.removed).toEqual(
      expect.arrayContaining([
        ".claude/skills/*/config.json",
        ".agents/skills/*/config.json",
      ]),
    );
  });

  it("leaves the agent-skills source skills/*/config.json rule alone", () => {
    const original = ["# source-only (A-615)", "skills/*/config.json", ""].join(
      "\n",
    );
    writeFileSync(ignorePath(), original);

    const result = stripSkillConfigIgnores(directory, { write: true });
    expect(result.status).toBe("clean");
    expect(read()).toBe(original);
  });

  it("is idempotent once the consumer patterns are gone", () => {
    writeFileSync(
      ignorePath(),
      "node_modules/\n.claude/skills/*/config.json\n",
    );
    stripSkillConfigIgnores(directory, { write: true });
    const after1 = read();
    expect(stripSkillConfigIgnores(directory, { write: true }).status).toBe(
      "clean",
    );
    expect(read()).toBe(after1);
  });

  it("strips leading-slash anchored consumer patterns", () => {
    writeFileSync(
      ignorePath(),
      "node_modules/\n/.claude/skills/*/config.json\n/.agents/skills/*/config.json\n",
    );

    const result = stripSkillConfigIgnores(directory, { write: true });
    expect(result.status).toBe("stripped");
    expect(read()).toBe("node_modules/\n");
    expect(result.removed).toEqual(
      expect.arrayContaining([
        "/.claude/skills/*/config.json",
        "/.agents/skills/*/config.json",
      ]),
    );
  });

  it("does not rewrite a file that only has consecutive blank lines", () => {
    const original = "node_modules/\n\n\ndist/\n";
    writeFileSync(ignorePath(), original);

    const result = stripSkillConfigIgnores(directory, { write: true });
    expect(result.status).toBe("clean");
    expect(read()).toBe(original);
  });

  it("records intervening wrap comments in removed for the audit trail", () => {
    writeFileSync(
      ignorePath(),
      [
        "# Per-skill agent-skills config.json is generated by the initialise-skills skill,",
        "# wrap line without the keywords",
        "# not committed (agent-skills v1.1.0 generated-config model, A-640).",
        ".claude/skills/*/config.json",
        "",
      ].join("\n"),
    );

    const result = stripSkillConfigIgnores(directory, { write: true });
    expect(result.status).toBe("stripped");
    expect(result.removed).toEqual(
      expect.arrayContaining(["# wrap line without the keywords"]),
    );
  });
});
