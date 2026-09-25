// Imports the BUNDLE module directly (the distributed `.mjs`), mirroring the
// changelog-config test wiring.
import {
  parseConfig,
  serialiseConfig,
} from "../../../skills/rheged-skills-setup/scripts/lib/jsonio.mjs";
import { describe, expect, it } from "vitest";

describe("parseConfig", () => {
  it("captures key order, indent and trailing newline", () => {
    const raw = '{\n  "b": 1,\n  "a": 2\n}\n';
    const parsed = parseConfig(raw);
    expect(parsed.keyOrder).toEqual(["b", "a"]);
    expect(parsed.indent).toBe(2);
    expect(parsed.trailingNewline).toBe(true);
    expect(parsed.data).toEqual({ a: 2, b: 1 });
  });

  it("detects a 4-space indent", () => {
    const raw = '{\n    "a": 1\n}';
    const parsed = parseConfig(raw);
    expect(parsed.indent).toBe(4);
    expect(parsed.trailingNewline).toBe(false);
  });

  it('preserves a tab indent as "\\t"', () => {
    const raw = '{\n\t"a": 1\n}\n';
    const parsed = parseConfig(raw);
    expect(parsed.indent).toBe("\t");
  });

  it("rejects a non-object root", () => {
    expect(() => parseConfig("[]")).toThrow(/JSON object/);
    expect(() => parseConfig("null")).toThrow(/JSON object/);
  });
});

describe("serialiseConfig", () => {
  it("preserves existing key order and appends new keys at the end", () => {
    const parsed = parseConfig('{\n  "b": 1,\n  "a": 2\n}\n');
    const out = serialiseConfig(parsed, { a: 2, b: 1, cc: 3 });
    expect(out).toBe('{\n  "b": 1,\n  "a": 2,\n  "cc": 3\n}\n');
  });

  it("honours appendOrder for keys new to the file", () => {
    const parsed = parseConfig('{\n  "a": 1\n}\n');
    const out = serialiseConfig(parsed, { a: 1, mm: 3, z: 2 }, ["mm", "z"]);
    expect(out).toBe('{\n  "a": 1,\n  "mm": 3,\n  "z": 2\n}\n');
  });

  it("preserves indent and trailing-newline style", () => {
    const parsed = parseConfig('{\n    "a": 1\n}');
    const out = serialiseConfig(parsed, { a: 1, b: 2 });
    expect(out).toBe('{\n    "a": 1,\n    "b": 2\n}');
  });

  it("round-trips a file with no changes byte-for-byte (idempotency)", () => {
    const raw =
      '{\n  "issueKeys": [\n    "A"\n  ],\n  "baseBranch": "main"\n}\n';
    const parsed = parseConfig(raw);
    expect(serialiseConfig(parsed, parsed.data)).toBe(raw);
  });

  it("round-trips a tab-indented file byte-for-byte", () => {
    const raw = '{\n\t"a": 1,\n\t"b": 2\n}\n';
    const parsed = parseConfig(raw);
    expect(serialiseConfig(parsed, parsed.data)).toBe(raw);
  });

  it("round-trips a CRLF file with CRLF line endings preserved", () => {
    const raw = '{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n';
    const parsed = parseConfig(raw);
    expect(parsed.newline).toBe("\r\n");
    expect(serialiseConfig(parsed, parsed.data)).toBe(raw);
  });
});
