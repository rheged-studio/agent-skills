// Imports the BUNDLE lib directly (the distributed `.mjs`). Covers the skills.lock
// build/serialise/write (A-616): facts-only provenance resolution, deterministic
// sorted output, byte-stable idempotent writes. Uses a tmp repo root so writes
// don't touch the host repo.
import {
  buildLock,
  lockPath,
  readLock,
  resolveRef,
  resolveSource,
  serialiseLock,
  writeLock,
} from "../../../skills/rheged-skills-setup/scripts/lib/skills-lock.mjs";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("resolveSource / resolveRef", () => {
  it("prefers a supplied fact", () => {
    expect(resolveSource({ source: "old" }, { lockSource: "new" })).toBe("new");
    expect(resolveRef({ ref: "main" }, { lockRef: "v2" })).toBe("v2");
  });

  it("preserves the existing lock's value when the fact is absent", () => {
    expect(resolveSource({ source: "kept" }, {})).toBe("kept");
    expect(resolveRef({ ref: "kept" }, {})).toBe("kept");
  });

  it("returns null when neither fact nor existing lock supplies a value", () => {
    expect(resolveSource(null, {})).toBeNull();
    expect(resolveRef(null, {})).toBeNull();
  });

  it("ignores blank/whitespace facts and trims", () => {
    expect(resolveSource(null, { lockSource: "   " })).toBeNull();
    expect(resolveSource(null, { lockSource: "  https://x  " })).toBe(
      "https://x",
    );
  });
});

describe("buildLock", () => {
  it("sorts skill keys for deterministic output", () => {
    // Deliberately unsorted insertion order (via fromEntries, which escapes the
    // sort-objects lint rule) so the assertion proves buildLock sorts.
    const lock = buildLock({
      installedVersions: Object.fromEntries([
        ["send", "1.0.0"],
        ["ant", "2.0.0"],
        ["mid", "3.0.0"],
      ]),
      ref: "main",
      source: "https://x",
    });
    expect(Object.keys(lock.skills)).toEqual(["ant", "mid", "send"]);
    expect(lock).toEqual({
      ref: "main",
      skills: { ant: "2.0.0", mid: "3.0.0", send: "1.0.0" },
      source: "https://x",
    });
  });

  it("carries null source/ref through unchanged", () => {
    const lock = buildLock({ installedVersions: {}, ref: null, source: null });
    expect(lock).toEqual({ ref: null, skills: {}, source: null });
  });
});

describe("serialiseLock", () => {
  it("emits 2-space JSON with a trailing newline and no timestamp", () => {
    const text = serialiseLock({
      ref: "main",
      skills: { a: "1.0.0" },
      source: "x",
    });
    expect(text).toBe(
      '{\n  "ref": "main",\n  "skills": {\n    "a": "1.0.0"\n  },\n  "source": "x"\n}\n',
    );
    expect(text).not.toContain("generatedAt");
  });

  it("is byte-identical when built twice from the same input", () => {
    const input = {
      installedVersions: { a: "1.0.0", b: "2.0.0" },
      ref: "main",
      source: "x",
    };
    expect(serialiseLock(buildLock(input))).toBe(
      serialiseLock(buildLock(input)),
    );
  });
});

function sampleLock() {
  return buildLock({
    installedVersions: { changelog: "0.9.1", "send-it": "0.6.1" },
    ref: "main",
    source: "https://github.com/rheged-studio/agent-skills",
  });
}

describe("readLock / writeLock", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "skills-lock-"));
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  it("returns null when no lock exists", () => {
    expect(readLock(root)).toBeNull();
  });

  it("dry-run reports would-write without touching disk", () => {
    const result = writeLock(root, sampleLock(), { write: false });
    expect(result.status).toBe("would-write");
    expect(existsSync(lockPath(root))).toBe(false);
  });

  it("write creates the .claude dir and file, and round-trips via readLock", () => {
    const result = writeLock(root, sampleLock(), { write: true });
    expect(result.status).toBe("written");
    expect(readLock(root)).toEqual(sampleLock());
  });

  it("is a byte-stable no-op on an unchanged re-run", () => {
    writeLock(root, sampleLock(), { write: true });
    const before = readFileSync(lockPath(root), "utf8");
    const result = writeLock(root, sampleLock(), { write: true });
    expect(result.status).toBe("unchanged");
    expect(readFileSync(lockPath(root), "utf8")).toBe(before);
  });

  it("reports would-write when content differs on a dry run", () => {
    writeLock(root, sampleLock(), { write: true });
    const changed = buildLock({
      installedVersions: { changelog: "1.0.0", "send-it": "0.6.1" },
      ref: "main",
      source: "https://github.com/rheged-studio/agent-skills",
    });
    expect(writeLock(root, changed, { write: false }).status).toBe(
      "would-write",
    );
  });

  it("treats a malformed existing lock as absent (null)", () => {
    mkdirSync(dirname(lockPath(root)), { recursive: true });
    writeFileSync(lockPath(root), "{ not json");
    expect(readLock(root)).toBeNull();
  });

  it("throws on a genuine IO error rather than masking it as 'no lock'", () => {
    // A directory at the lock path exists but can't be read as a file (EISDIR):
    // a real IO error must surface, not collapse to null like a malformed lock.
    mkdirSync(lockPath(root), { recursive: true });
    expect(() => readLock(root)).toThrow(/could not read/);
  });
});
