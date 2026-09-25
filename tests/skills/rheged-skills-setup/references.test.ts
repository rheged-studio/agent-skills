// Covers the detectable-keys reference parser (A-702) that annotates the
// read-only `--review` report. Parses the bundled GFM table into a per-key
// description map, ignoring the intro prose and the `## Notes` bullet list.
import {
  loadDetectableKeys,
  parseDetectableKeys,
} from "../../../skills/rheged-skills-setup/scripts/lib/references.mjs";
import { describe, expect, it } from "vitest";

const FIXTURE = `# Detectable config keys

Some intro prose that mentions a | pipe but is not a table row.

| Key | Used by | Detection source | Fallback / when undetectable |
| --- | --- | --- | --- |
| \`baseBranch\` | changelog, send-it | \`git symbolic-ref refs/remotes/origin/HEAD\`, stripped of \`origin/\` | \`main\` |
| \`issueKeys\` | changelog, cleanup-repo | Leading \`<KEY>-<num>\`; or supplied facts | \`needs-manual-input\` |

## Notes and known limitations (v0.1.0)

- **\`preflight\` is skipped entirely.** This bullet has backticks but no pipes.
`;

describe("parseDetectableKeys", () => {
  it("maps each key row to its used-by, detection-source and fallback cells", () => {
    const map = parseDetectableKeys(FIXTURE);
    expect(map.get("baseBranch")).toEqual({
      detectionSource:
        "`git symbolic-ref refs/remotes/origin/HEAD`, stripped of `origin/`",
      fallback: "`main`",
      usedBy: "changelog, send-it",
    });
  });

  it("strips the backticks from the key name", () => {
    const map = parseDetectableKeys(FIXTURE);
    expect(map.has("issueKeys")).toBe(true);
    expect(map.has("`issueKeys`")).toBe(false);
  });

  it("ignores the header, separator, intro prose and Notes bullets", () => {
    const map = parseDetectableKeys(FIXTURE);
    expect([...map.keys()].toSorted()).toEqual(["baseBranch", "issueKeys"]);
    expect(map.has("preflight")).toBe(false);
    expect(map.has("Key")).toBe(false);
  });

  it("returns an empty map for non-string input", () => {
    expect(parseDetectableKeys(undefined).size).toBe(0);
  });
});

describe("loadDetectableKeys", () => {
  it("reads the bundled reference and includes the real detectable keys", () => {
    const map = loadDetectableKeys();
    // A representative sample of keys the shipped table documents.
    expect(map.has("baseBranch")).toBe(true);
    expect(map.has("issueKeys")).toBe(true);
    expect(map.get("baseBranch")?.usedBy).toContain("changelog");
  });

  it("returns an empty map (never throws) for a missing file", () => {
    const map = loadDetectableKeys("/no/such/detectable-keys.md");
    expect(map.size).toBe(0);
  });
});
