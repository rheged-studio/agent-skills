// Imports the BUNDLE script directly (the distributed `.mjs`). `rewriteBody`
// uses the bundle's own config.json (workspace `rheged-studio`, key A).
import { rewriteBody } from "../../../skills/changelog/scripts/add-links.mjs";
import { describe, expect, it } from "vitest";

describe("rewriteBody — reference-style link masking (bug 4)", () => {
  it("does not rewrite inside a numbered reference label `[R-123][1]`", () => {
    const body = "See [R-123][1] for detail.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not rewrite inside a collapsed reference label `[R-123][]`", () => {
    const body = "See [R-123][] for detail.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("does not rewrite inside a named reference label `[R-123][ref]`", () => {
    const body = "See [R-123][ref] for detail.";
    expect(rewriteBody(body)).toBe(body);
  });

  it("is idempotent on a second run over reference-style labels", () => {
    const body = "Closes [R-123][1] and [R-7][].";
    const once = rewriteBody(body);
    expect(once).toBe(body);
    expect(rewriteBody(once)).toBe(once);
  });

  it("still links a bare ID alongside a reference-style label", () => {
    const body = "Closes R-9, tracked in [R-123][1].";
    expect(rewriteBody(body)).toBe(
      "Closes [R-9](https://linear.app/rheged-studio/issue/R-9), tracked in [R-123][1].",
    );
  });

  it("is idempotent on an already-linked inline ID (regression guard)", () => {
    const body = "[R-123](https://linear.app/rheged-studio/issue/R-123)";
    expect(rewriteBody(body)).toBe(body);
    expect(rewriteBody(rewriteBody(body))).toBe(body);
  });

  it("does not rewrite the companion reference definition line", () => {
    const body =
      "See [R-123][] for detail.\n\n[R-123]: https://example.com/whatever\n";
    expect(rewriteBody(body)).toBe(body);
  });

  it("is idempotent across a collapsed reference usage and its definition", () => {
    const body =
      "See [R-123][] for detail.\n\n[R-123]: https://example.com/whatever\n";
    const once = rewriteBody(body);
    expect(once).toBe(body);
    expect(rewriteBody(once)).toBe(once);
  });

  it("does not rewrite a reference definition indented up to three spaces", () => {
    const body =
      "See [R-123][] for detail.\n\n   [R-123]: https://example.com/whatever\n";
    expect(rewriteBody(body)).toBe(body);
    expect(rewriteBody(rewriteBody(body))).toBe(body);
  });

  it("still links a bare ID in prose while leaving the definition intact", () => {
    const body = "Closes R-9.\n\n[R-123]: https://example.com/whatever\n";
    expect(rewriteBody(body)).toBe(
      "Closes [R-9](https://linear.app/rheged-studio/issue/R-9).\n\n[R-123]: https://example.com/whatever\n",
    );
  });
});
