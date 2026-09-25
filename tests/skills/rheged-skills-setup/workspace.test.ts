// Imports the BUNDLE script directly (the distributed `.mjs`). Regression cover
// for A-460: the fallback used to return a hard-coded `["apps","packages",
// "services"]` regardless of what existed on disk, so a repo with no workspace
// manifest "detected" three phantom roots.
import {
  detectPackageRoots,
  globsFromWorkspacesField,
  parseWorkspaceGlobs,
  rootsFromGlobs,
} from "../../../skills/rheged-skills-setup/scripts/lib/workspace.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("detectPackageRoots", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "workspace-roots-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("reads roots from pnpm-workspace.yaml (authoritative — not filtered by disk)", () => {
    writeFileSync(
      join(directory, "pnpm-workspace.yaml"),
      'packages:\n  - "apps/*"\n  - "packages/*"\n',
    );
    // The globbed dirs don't exist on disk, but a declaration is authoritative.
    expect(detectPackageRoots(directory)).toEqual(["apps", "packages"]);
  });

  it("reads roots from the package.json workspaces field", () => {
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ workspaces: ["modules/*", "tooling/cli"] }),
    );
    expect(detectPackageRoots(directory)).toEqual(["modules", "tooling"]);
  });

  it("pnpm-workspace.yaml wins over the package.json workspaces field", () => {
    writeFileSync(
      join(directory, "pnpm-workspace.yaml"),
      'packages:\n  - "apps/*"\n',
    );
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ workspaces: ["modules/*"] }),
    );
    expect(detectPackageRoots(directory)).toEqual(["apps"]);
  });

  it("treats a catalogs-only pnpm-workspace.yaml as authoritative (no invented roots)", () => {
    // A `catalogs:`-only file (pnpm ≥9.5) declares a workspace with no package
    // globs. The manifest is authoritative: return [] rather than falling through
    // to the package.json / default-directory guess. Stack the deck — a workspaces
    // field AND an on-disk default candidate that the old fall-through would have
    // picked up — to prove the manifest short-circuits both.
    writeFileSync(
      join(directory, "pnpm-workspace.yaml"),
      "catalogs:\n  react18:\n    react: ^18.3.1\n",
    );
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ workspaces: ["modules/*"] }),
    );
    mkdirSync(join(directory, "packages"));
    expect(detectPackageRoots(directory)).toEqual([]);
  });

  it("treats an empty packages: list as authoritative []", () => {
    writeFileSync(join(directory, "pnpm-workspace.yaml"), "packages: []\n");
    mkdirSync(join(directory, "apps"));
    expect(detectPackageRoots(directory)).toEqual([]);
  });

  it("falls back to the default candidates that actually exist on disk", () => {
    // No manifest; only one of the default candidates is present.
    mkdirSync(join(directory, "packages"));
    expect(detectPackageRoots(directory)).toEqual(["packages"]);
  });

  it("returns [] when there is no manifest and no default candidate on disk", () => {
    // The phantom-roots bug: this used to return ["apps","packages","services"].
    expect(detectPackageRoots(directory)).toEqual([]);
  });

  it("ignores a non-directory named like a default candidate", () => {
    // A regular file (or symlink) called `packages` must not leak in as a root —
    // the fallback is strictly directory-backed.
    writeFileSync(join(directory, "packages"), "not a directory\n");
    expect(detectPackageRoots(directory)).toEqual([]);
  });

  it("returns [] for a missing/empty repo root rather than guessing", () => {
    expect(detectPackageRoots(join(directory, "does-not-exist"))).toEqual([]);
  });
});

describe("workspace pure parsers", () => {
  it("parseWorkspaceGlobs reads the packages: block and stops at the next key", () => {
    const yaml =
      'packages:\n  - "apps/*"\n  - packages/ui\nonlyBuiltDependencies:\n  - esbuild\n';
    expect(parseWorkspaceGlobs(yaml)).toEqual(["apps/*", "packages/ui"]);
  });

  it("parseWorkspaceGlobs strips quotes and keeps tab-indented list items (A-465)", () => {
    // Tab-indented items must not be read as a new top-level key ending the
    // block, and surrounding quotes are stripped.
    const yaml = "packages:\n\t- 'apps/*'\n\t- \"packages/*\"\n";
    expect(parseWorkspaceGlobs(yaml)).toEqual(["apps/*", "packages/*"]);
  });

  it("rootsFromGlobs reduces globs to distinct top-level roots, skipping ., *, and negations", () => {
    expect(
      rootsFromGlobs([
        "apps/*",
        "packages/ui",
        ".",
        "*",
        "!packages/private/*",
      ]),
    ).toEqual(["apps", "packages"]);
  });

  it("globsFromWorkspacesField accepts both array and { packages } shapes", () => {
    expect(globsFromWorkspacesField(["a/*", "b/*"])).toEqual(["a/*", "b/*"]);
    expect(globsFromWorkspacesField({ packages: ["c/*"] })).toEqual(["c/*"]);
    expect(globsFromWorkspacesField(undefined)).toEqual([]);
  });
});
