// Imports the BUNDLE script directly (the distributed `.mjs`). `rewriteBody`
// reads the bundle's own config.json (workspace `rheged-studio`, key
// A). Reference-style label masking is covered against the bundle
// in ./add-links-reference-masking.test.ts; this suite
// covers the issue-key rewrite happy path plus inline-code / fenced-block
// masking and the splitFrontmatter contract.
import {
  frontmatterBranch,
  rewriteBody,
  splitFrontmatter,
} from "../../../skills/changelog/scripts/add-links.mjs";
import { describe, expect, it } from "vitest";

function url(id: string) {
  return `https://linear.app/rheged-studio/issue/${id}`;
}

describe("rewriteBody — issue-key linking (happy path)", () => {
  it("links a bare issue ID for each configured team key", () => {
    expect(rewriteBody("Closes R-12.")).toBe(`Closes [R-12](${url("R-12")}).`);
    expect(rewriteBody("Closes R-3.")).toBe(`Closes [R-3](${url("R-3")}).`);
    expect(rewriteBody("Closes R-9.")).toBe(`Closes [R-9](${url("R-9")}).`);
    expect(rewriteBody("Closes R-401.")).toBe(
      `Closes [R-401](${url("R-401")}).`,
    );
  });

  it("links several IDs in one body", () => {
    expect(rewriteBody("R-1 and R-2 both landed.")).toBe(
      `[R-1](${url("R-1")}) and [R-2](${url("R-2")}) both landed.`,
    );
  });

  it("leaves unknown team keys untouched", () => {
    const body = "ZZ-9 is not a configured key.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("is idempotent — a second pass does not double-link", () => {
    const once = rewriteBody("Closes R-12.");
    expect(rewriteBody(once)).toBe(once);
  });
});

describe("rewriteBody — masking", () => {
  it("does not link an ID inside inline code", () => {
    const body = "Run `validate R-12` before merge.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not link an ID inside a fenced code block", () => {
    const body = "```\nbranch R-12 created\n```\n";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not re-link an already-linked inline ID", () => {
    const body = `See [R-12](${url("R-12")}) for detail.`;
    expect(rewriteBody(body)).toBe(body);
  });

  it("round-trips inline code nested inside a link without leaking NUL bytes", () => {
    // The inner inline-code span masks first, then the whole `[<token>](url)`
    // masks again — the unmask must be reentrant or a literal NUL token survives
    // and turns the entry into a binary blob (R-577).
    const body = "See [`R-12`](https://example.test/R-12) for the helper.";
    const out = rewriteBody(body);
    expect(out).toBe(body);
    expect(out).not.toContain("\u0000");
  });

  it("links a bare ID whilst leaving a fenced/inline-code occurrence masked", () => {
    const body = "Closes R-12; see `R-12` and:\n```\nR-12\n```\n";
    expect(rewriteBody(body)).toBe(
      `Closes [R-12](${url("R-12")}); see \`R-12\` and:\n\`\`\`\nR-12\n\`\`\`\n`,
    );
  });

  it("leaves literal text that looks like a mask token untouched", () => {
    // Pre-sentinel, the restore pass would have mangled bare "FENCE0"/"LINK0".
    expect(rewriteBody("Set placeholder FENCE0 and LINK0 in the doc.")).toBe(
      "Set placeholder FENCE0 and LINK0 in the doc.",
    );
  });

  it("links an ID even when a mask-token-like string is also present", () => {
    expect(rewriteBody("FENCE0 — closes R-9.")).toBe(
      `FENCE0 — closes [R-9](${url("R-9")}).`,
    );
  });
});

describe("splitFrontmatter", () => {
  it("splits leading frontmatter from the body", () => {
    const raw = "---\ntitle: x\n---\n## Added\n\n- A change\n";
    expect(splitFrontmatter(raw)).toEqual({
      body: "## Added\n\n- A change\n",
      fm: "---\ntitle: x\n---\n",
    });
  });

  it("returns the whole string as body when there is no frontmatter", () => {
    const raw = "## Added\n\n- A change\n";
    expect(splitFrontmatter(raw)).toEqual({ body: raw, fm: "" });
  });

  it("splits CRLF frontmatter from the body", () => {
    // splitFrontmatter's fence regex accepts `\r?\n`, so a Windows-authored
    // changelog file must split the same way as an LF one.
    const raw = "---\r\ntitle: x\r\n---\r\n## Added\r\n";
    expect(splitFrontmatter(raw)).toEqual({
      body: "## Added\r\n",
      fm: "---\r\ntitle: x\r\n---\r\n",
    });
  });
});

describe("frontmatterBranch — branch-scoped default (R-603)", () => {
  it("reads the branch from an entry's frontmatter", () => {
    const raw =
      "---\ntitle: x\nbranch: a-603-add-links-scope\nversion:\n---\n## Added\n";
    expect(frontmatterBranch(raw)).toBe("a-603-add-links-scope");
  });

  it("strips surrounding quotes", () => {
    expect(frontmatterBranch('---\nbranch: "a-1-foo"\n---\nbody')).toBe(
      "a-1-foo",
    );
  });

  it("returns null when there is no branch field", () => {
    expect(frontmatterBranch("---\ntitle: x\n---\nbody")).toBeNull();
  });

  it("returns null when there is no frontmatter at all", () => {
    expect(frontmatterBranch("## Added\n\n- a change\n")).toBeNull();
  });

  it("returns null for a blank branch value", () => {
    expect(frontmatterBranch("---\nbranch:\n---\nbody")).toBeNull();
  });

  it("only reads the frontmatter region, not a `branch:`-like line in the body", () => {
    const raw =
      "---\ntitle: x\n---\nThe branch: main note in prose is ignored.\n";
    expect(frontmatterBranch(raw)).toBeNull();
  });
});
