// Imports the helper directly (the distributed `.mjs`). Covers the pure
// dogfood-config materialisation (R-615): mapping each
// infrastructure/dogfood-config/<name>.json to skills/<name>/config.json, the
// copy itself, and drift detection. The same assertions back the script's
// `--self-test`; this wires them into CI.
import {
  checkDrift,
  materialise,
  planBootstrap,
} from "../scripts/bootstrap-config.mjs";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("bootstrap-config", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bootstrap-config-test-"));
    mkdirSync(join(root, "infrastructure/dogfood-config"), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });

  function dogfood(name: string, body: string) {
    writeFileSync(
      join(root, "infrastructure/dogfood-config", `${name}.json`),
      body,
    );
  }

  it("maps each dogfood entry to its skills/<name>/config.json target", () => {
    dogfood("send-it", "{}\n");
    dogfood("changelog", "{}\n");

    const plan = planBootstrap(root);
    expect(plan.map((entry) => entry.name)).toEqual(["changelog", "send-it"]);
    expect(plan[1].target).toBe(join(root, "skills", "send-it", "config.json"));
  });

  it("materialises config.json byte-for-byte and is then drift-free", () => {
    mkdirSync(join(root, "skills/send-it"), { recursive: true });
    dogfood("send-it", '{\n  "baseBranch": "main"\n}\n');

    materialise(root);

    expect(readFileSync(join(root, "skills/send-it/config.json"), "utf8")).toBe(
      '{\n  "baseBranch": "main"\n}\n',
    );
    expect(checkDrift(root)).toEqual([]);
  });

  it("reports a missing target before materialise and drift after a hand-edit", () => {
    mkdirSync(join(root, "skills/send-it"), { recursive: true });
    dogfood("send-it", '{\n  "baseBranch": "main"\n}\n');

    expect(checkDrift(root)).toEqual([{ name: "send-it", reason: "missing" }]);

    materialise(root);
    writeFileSync(
      join(root, "skills/send-it/config.json"),
      '{\n  "baseBranch": "dev"\n}\n',
    );
    expect(checkDrift(root)).toEqual([{ name: "send-it", reason: "drift" }]);
  });

  it("throws when a dogfood entry has no matching bundle", () => {
    dogfood("ghost", "{}\n");
    expect(() => materialise(root)).toThrow(
      /no matching skills\/ghost\/ bundle/,
    );
    expect(existsSync(join(root, "skills/ghost/config.json"))).toBe(false);
  });

  it("returns an empty plan when the dogfood dir is absent", () => {
    rmSync(join(root, "infrastructure/dogfood-config"), { recursive: true });
    expect(planBootstrap(root)).toEqual([]);
  });
});
