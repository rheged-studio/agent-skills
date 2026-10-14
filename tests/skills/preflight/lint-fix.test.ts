// Imports the BUNDLE script directly (the distributed `.mjs`). Covers the pure
// auto-fix command planner (R-465): run order, the root+scripts eslint merge,
// one `--filter`ed invocation per workspace with changes, and the markdownlint
// tail. The actual spawning stays behind the CLI `main()` guard.
import { planFixCommands } from "../../../skills/preflight/scripts/lint-fix.mjs";
import { describe, expect, it } from "vitest";

const EMPTY_SCOPE = {
  codeChanged: false,
  eslint: { root: [], scripts: [] },
  markdown: [],
  markdownChanged: false,
  workspaces: {},
};

describe("planFixCommands", () => {
  it("plans nothing when nothing changed", () => {
    expect(planFixCommands(EMPTY_SCOPE)).toEqual([]);
  });

  it("merges scripts + root into a single eslint --fix invocation", () => {
    const commands = planFixCommands({
      ...EMPTY_SCOPE,
      codeChanged: true,
      eslint: { root: ["eslint.config.js"], scripts: ["scripts/a.mjs"] },
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].argv).toEqual([
      "exec",
      "eslint",
      "--fix",
      "--",
      "scripts/a.mjs",
      "eslint.config.js",
    ]);
  });

  it("emits one --filter eslint per workspace with changed files, skipping empty ones", () => {
    const commands = planFixCommands({
      ...EMPTY_SCOPE,
      codeChanged: true,
      eslint: {
        api: [],
        root: [],
        scripts: [],
        web: ["apps/web/src/x.ts"],
      },
      workspaces: {
        api: { filter: "@acme/api", prefix: "services/api/" },
        web: { filter: "@acme/web", prefix: "apps/web/" },
      },
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].argv).toEqual([
      "--filter",
      "@acme/web",
      "exec",
      "eslint",
      "--fix",
      "--",
      "apps/web/src/x.ts",
    ]);
  });

  it("appends a markdownlint --fix command for changed markdown", () => {
    const commands = planFixCommands({
      ...EMPTY_SCOPE,
      markdown: ["README.md"],
      markdownChanged: true,
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].argv).toEqual([
      "exec",
      "markdownlint-cli2",
      "--fix",
      "README.md",
    ]);
  });
});
