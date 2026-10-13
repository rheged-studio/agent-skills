// Imports the BUNDLE script directly (the distributed `.mjs`). These cover the
// pure, git-free surface of the preflight scope helpers (R-465): the
// changed-file classifier, the workspace-relativiser, the workspace
// auto-detector, and the config-override resolver. The git-backed helpers
// (gitMergeBase / gitChangedFiles / getBranchScope) need a live repo and are
// exercised end-to-end by the skill itself, not here.
import {
  classifyChangedFiles,
  detectWorkspaces,
  relativiseToWorkspace,
  resolveConfig,
} from "../../../skills/preflight/scripts/lib/scope.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WORKSPACES = {
  web: { filter: "@acme/web", prefix: "apps/web/" },
};

describe("classifyChangedFiles", () => {
  it("buckets workspace code, root config, and scripts separately", () => {
    const out = classifyChangedFiles(
      [
        "apps/web/src/index.ts",
        "scripts/release.mjs",
        "eslint.config.js",
        "tsconfig.eslint.json",
      ],
      WORKSPACES,
    );
    expect(out.codeChanged).toBe(true);
    expect(out.eslint.web).toEqual(["apps/web/src/index.ts"]);
    expect(out.eslint.scripts).toEqual(["scripts/release.mjs"]);
    expect(out.eslint.root).toEqual([
      "eslint.config.js",
      "tsconfig.eslint.json",
    ]);
  });

  it("collects markdown but ignores vendored skill bundles", () => {
    const out = classifyChangedFiles(
      ["README.md", ".claude/skills/send-it/SKILL.md", "docs/guide.mdx"],
      WORKSPACES,
    );
    expect(out.markdownChanged).toBe(true);
    expect(out.markdown).toEqual(["README.md", "docs/guide.mdx"]);
  });

  it("flags workflow changes and targets the changed workflow files", () => {
    const out = classifyChangedFiles(
      [".github/workflows/ci.yml", ".github/workflows/release.yaml"],
      WORKSPACES,
    );
    expect(out.workflowsChanged).toBe(true);
    expect(out.actionlintTargets).toEqual([
      ".github/workflows/ci.yml",
      ".github/workflows/release.yaml",
    ]);
  });

  it("treats a non-runnable code gate (pnpm-lock.yaml) as code without an eslint target", () => {
    const out = classifyChangedFiles(["pnpm-lock.yaml"], WORKSPACES);
    expect(out.codeChanged).toBe(true);
    expect(out.eslint.root).toEqual([]);
    expect(out.eslint.web).toEqual([]);
    expect(out.eslint.scripts).toEqual([]);
  });

  it("routes top-level lintable code with no workspace match into the root bucket (R-527 regression)", () => {
    // Before the fix these set codeChanged=true but landed in no eslint bucket,
    // so preflight reported ESLint "ran", skipped every empty group, and passed
    // — a silent false-pass. They must now be linted at the repo root.
    const out = classifyChangedFiles(
      ["foo.ts", "lib/bar.ts", "vitest.config.ts"],
      WORKSPACES,
    );
    expect(out.codeChanged).toBe(true);
    expect(out.eslint.root).toEqual([
      "foo.ts",
      "lib/bar.ts",
      "vitest.config.ts",
    ]);
    expect(out.eslint.web).toEqual([]);
    expect(out.eslint.scripts).toEqual([]);
  });
});

describe("relativiseToWorkspace", () => {
  it("strips a workspace prefix so paths resolve from the workspace cwd", () => {
    expect(
      relativiseToWorkspace(
        ["apps/web/src/a.ts", "apps/web/b.ts"],
        "apps/web/",
      ),
    ).toEqual(["src/a.ts", "b.ts"]);
  });

  it("returns paths unchanged when the prefix is empty or unmatched", () => {
    expect(relativiseToWorkspace(["src/a.ts"], "")).toEqual(["src/a.ts"]);
    expect(relativiseToWorkspace(["src/a.ts"], "apps/web/")).toEqual([
      "src/a.ts",
    ]);
  });
});

describe("detectWorkspaces / resolveConfig", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "preflight-scope-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  function writeWorkspace(relative: string, pkg: object) {
    mkdirSync(join(directory, relative), { recursive: true });
    writeFileSync(
      join(directory, relative, "package.json"),
      JSON.stringify(pkg),
    );
  }

  it("includes only workspaces that declare a lint script", () => {
    writeFileSync(
      join(directory, "pnpm-workspace.yaml"),
      'packages:\n  - "apps/*"\n',
    );
    writeWorkspace("apps/web", {
      name: "@acme/web",
      scripts: { lint: "eslint ." },
    });
    writeWorkspace("apps/docs", { name: "@acme/docs", scripts: {} });

    const workspaces = detectWorkspaces(directory);
    expect(Object.keys(workspaces)).toEqual(["web"]);
    expect(workspaces.web).toEqual({
      filter: "@acme/web",
      prefix: "apps/web/",
    });
  });

  it("returns no workspaces when there is no pnpm-workspace.yaml", () => {
    expect(detectWorkspaces(directory)).toEqual({});
  });

  it("lets a preflight.config.json override win over auto-detection", () => {
    writeFileSync(
      join(directory, "preflight.config.json"),
      JSON.stringify({
        baseBranch: "develop",
        workspaces: { api: { filter: "@acme/api", prefix: "services/api" } },
      }),
    );
    const config = resolveConfig(directory);
    expect(config.baseBranch).toBe("develop");
    // The slash-less prefix is normalised to a trailing slash.
    expect(config.workspaces.api).toEqual({
      filter: "@acme/api",
      prefix: "services/api/",
    });
  });
});
