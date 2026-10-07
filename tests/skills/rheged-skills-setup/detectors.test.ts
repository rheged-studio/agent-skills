// Imports the BUNDLE script directly (the distributed `.mjs`). The two boolean
// detectors return repo-independent constants, so a dummy repoRoot is fine —
// they never touch the filesystem. Regression cover for A-459: before this,
// triage-pr's `promoteOnGreen` / `replyOnAccept` had no detector and were
// reported `needs-manual-input` on every `initialise-skills` run.
import {
  createDetectors,
  detectClaudeReviewCallerJob,
} from "../../../skills/rheged-skills-setup/scripts/lib/detectors.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function detectorsFor() {
  return createDetectors({ repoRoot: "/nonexistent" });
}

describe("createDetectors — triage-pr boolean defaults", () => {
  it("infers promoteOnGreen=true (auto-promotion is the default-on opt-out model)", () => {
    const { detect, has } = detectorsFor();
    expect(has("promoteOnGreen")).toBe(true);
    expect(detect("promoteOnGreen")).toEqual({ value: true });
  });

  it("infers replyOnAccept=true (matches triage-pr's own default)", () => {
    const { detect, has } = detectorsFor();
    expect(has("replyOnAccept")).toBe(true);
    expect(detect("replyOnAccept")).toEqual({ value: true });
  });

  it("infers deferNonBlocking=true (impact gate is the default-on opt-out model)", () => {
    const { detect, has } = detectorsFor();
    expect(has("deferNonBlocking")).toBe(true);
    expect(detect("deferNonBlocking")).toEqual({ value: true });
  });

  it("infers humanEnvelope=false (unattended Phase B is the default)", () => {
    const { detect, has } = detectorsFor();
    expect(has("humanEnvelope")).toBe(true);
    expect(detect("humanEnvelope")).toEqual({ value: false });
  });

  // A-1151: send-it's Step 11 triage chain. Fixed `true` rather than "is triage-pr
  // vendored?" — Step 11 soft-skips with a warning when the sibling is absent.
  it("infers triage=true (send-it chains into triage-pr by default)", () => {
    const { detect, has } = detectorsFor();
    expect(has("triage")).toBe(true);
    expect(detect("triage")).toEqual({ value: true });
  });

  it("infers reviewIdleMinutes=10 and reviewWaitMaxMinutes=20", () => {
    const { detect, has } = detectorsFor();
    expect(has("reviewIdleMinutes")).toBe(true);
    expect(detect("reviewIdleMinutes")).toEqual({ value: 10 });
    expect(detect("reviewWaitMaxMinutes")).toEqual({ value: 20 });
  });

  it("never returns null for the boolean keys (so none flags needs-manual-input)", () => {
    const { detect } = detectorsFor();
    expect(detect("triage")).not.toBeNull();
    expect(detect("promoteOnGreen")).not.toBeNull();
    expect(detect("replyOnAccept")).not.toBeNull();
    expect(detect("deferNonBlocking")).not.toBeNull();
    expect(detect("humanEnvelope")).not.toBeNull();
    expect(detect("reviewIdleMinutes")).not.toBeNull();
    expect(detect("reviewWaitMaxMinutes")).not.toBeNull();
  });
});

// A-567 / A-1204: triage-pr follow-up capture defaults — label + state stay
// confident structural defaults; project is required when capture is on
// (linearTeamName supplied via facts) and otherwise stays empty.
describe("createDetectors — triage-pr follow-up capture defaults", () => {
  it("infers followUpLabel follow-up / empty followUpProject and a Backlog state when capture is off", () => {
    const { detect, has } = detectorsFor();
    expect(has("followUpLabel")).toBe(true);
    expect(detect("followUpLabel")).toEqual({ value: "follow-up" });
    expect(detect("followUpProject")).toEqual({ value: "" });
    expect(detect("followUpState")).toEqual({ value: "Backlog" });
  });

  it("never returns null for label / state (so neither flags needs-manual-input)", () => {
    const { detect } = detectorsFor();
    expect(detect("followUpLabel")).not.toBeNull();
    expect(detect("followUpState")).not.toBeNull();
  });

  it("flags followUpProject needs-manual-input when linearTeamName is set without a project fact", () => {
    const { detect } = createDetectors({
      linearFacts: { linearTeamName: "Rheged Studio" },
      repoRoot: "/nonexistent",
    });
    expect(detect("followUpProject")).toBeNull();
  });

  it("uses facts.followUpProject when supplied", () => {
    const { detect } = createDetectors({
      linearFacts: {
        followUpProject: "Follow-up issues",
        linearTeamName: "Rheged Studio",
      },
      repoRoot: "/nonexistent",
    });
    expect(detect("followUpProject")).toEqual({ value: "Follow-up issues" });
  });
});

// Regression cover for A-460: packageRoots must signal "couldn't detect" (null)
// when there's no workspace manifest and none of the default candidates exist,
// rather than reporting a fabricated `["apps","packages","services"]`.
describe("createDetectors — packageRoots", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "detectors-roots-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("returns null when no manifest and no default candidate exists on disk", () => {
    const { detect } = createDetectors({ repoRoot: directory });
    expect(detect("packageRoots")).toBeNull();
  });

  it("returns the declared roots when a pnpm workspace is present", () => {
    writeFileSync(
      join(directory, "pnpm-workspace.yaml"),
      'packages:\n  - "apps/*"\n',
    );
    const { detect } = createDetectors({ repoRoot: directory });
    expect(detect("packageRoots")).toEqual({ value: ["apps"] });
  });

  it("does not throw deriving shippablePaths when packageRoots is null", () => {
    // No package.json `files`, no manifest → packageRoots is null; shippablePaths
    // must null-guard rather than dereference `.value` on null.
    const { detect } = createDetectors({ repoRoot: directory });
    expect(() => detect("shippablePaths")).not.toThrow();
    expect(detect("shippablePaths")).toEqual({ value: [] });
  });
});

// A-461: affected_packages is monorepo-only. The detector mirrors the
// packageRoots workspace signal so single-package repos get `false` (field
// omitted) and genuine monorepos get `true`. It always emits a value (never
// null) so it is never flagged needs-manual-input.
describe("createDetectors — affectedPackages", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "detectors-affected-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  it("infers false when no workspace config is detected (single package)", () => {
    const { detect, has } = createDetectors({ repoRoot: directory });
    expect(has("affectedPackages")).toBe(true);
    expect(detect("affectedPackages")).toEqual({ value: false });
  });

  it("infers true when a pnpm workspace is present (monorepo)", () => {
    writeFileSync(
      join(directory, "pnpm-workspace.yaml"),
      'packages:\n  - "apps/*"\n',
    );
    const { detect } = createDetectors({ repoRoot: directory });
    expect(detect("affectedPackages")).toEqual({ value: true });
  });
});

function caller(job: string, ref = "@v1") {
  return `name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]

jobs:
  ${job}:
    uses: rheged-studio/shared-workflows/.github/workflows/reusable-claude-code-review.yml${ref}
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
`;
}

// A-2453: map `claude` to the estate Claude review check when the repo calls the
// shared reusable workflow, so a clean review settles on the terminal check.
describe("createDetectors — reviewBotChecks", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "detectors-review-checks-"));
  });

  afterEach(() => {
    rmSync(directory, { force: true, recursive: true });
  });

  function writeWorkflow(name: string, text: string) {
    mkdirSync(join(directory, ".github", "workflows"), { recursive: true });
    writeFileSync(join(directory, ".github", "workflows", name), text);
  }

  it("maps claude to the caller job's check, pinned to github-actions", () => {
    writeWorkflow("claude-code-review.yml", caller("claude-review"));
    const { detect } = createDetectors({ repoRoot: directory });
    expect(detect("reviewBotChecks")).toEqual({
      value: {
        claude: { name: "claude-review", producer: "github-actions" },
      },
    });
  });

  it("uses the caller's own job id (the check's leading segment)", () => {
    writeWorkflow("review.yaml", caller("ai-review", "@0123abcd # v1.0.0"));
    expect(detectClaudeReviewCallerJob(directory)).toBe("ai-review");
  });

  it("emits {} when no workflow calls the reusable Claude review", () => {
    writeWorkflow(
      "validate.yml",
      "jobs:\n  lint:\n    uses: rheged-studio/shared-workflows/.github/workflows/reusable-lint.yml@v1\n",
    );
    const { detect } = createDetectors({ repoRoot: directory });
    expect(detect("reviewBotChecks")).toEqual({ value: {} });
  });

  it("emits {} when there is no .github/workflows directory", () => {
    const { detect } = createDetectors({ repoRoot: directory });
    expect(detect("reviewBotChecks")).toEqual({ value: {} });
  });

  it("accepts a caller still pointed at the pre-rename acme-skunkworks owner", () => {
    writeWorkflow(
      "claude-code-review.yml",
      caller("claude-review").replace("rheged-studio/", "acme-skunkworks/"),
    );
    expect(detectClaudeReviewCallerJob(directory)).toBe("claude-review");
  });

  it("ignores a same-named reusable workflow from another repository", () => {
    writeWorkflow(
      "claude-code-review.yml",
      caller("claude-review").replace("rheged-studio/", "someone-else/"),
    );
    expect(detectClaudeReviewCallerJob(directory)).toBeNull();
  });

  it("ignores a uses: line inside a run block (not a direct job field)", () => {
    writeWorkflow(
      "notes.yml",
      "jobs:\n  notes:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          echo uses: rheged-studio/shared-workflows/.github/workflows/reusable-claude-code-review.yml@v1\n          uses: rheged-studio/shared-workflows/.github/workflows/reusable-claude-code-review.yml@v1\n",
    );
    expect(detectClaudeReviewCallerJob(directory)).toBeNull();
  });

  it("ignores a commented-out caller", () => {
    writeWorkflow(
      "claude-code-review.yml",
      "jobs:\n  claude-review:\n    # uses: rheged-studio/shared-workflows/.github/workflows/reusable-claude-code-review.yml@v1\n    runs-on: ubuntu-latest\n",
    );
    expect(detectClaudeReviewCallerJob(directory)).toBeNull();
  });
});
