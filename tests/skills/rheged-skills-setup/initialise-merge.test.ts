// Imports the BUNDLE module directly (the distributed `.mjs`).
import {
  classifyKey,
  deepEqual,
  mergeConfig,
  sameSet,
  valuesEqual,
} from "../../../skills/rheged-skills-setup/scripts/lib/merge.mjs";
import { describe, expect, it } from "vitest";

function detected(value: unknown): { value: unknown } {
  return { value };
}

describe("deepEqual", () => {
  it("compares primitives, arrays and nested objects", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "b")).toBe(false);
    expect(deepEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(deepEqual(["a", "b"], ["b", "a"])).toBe(false);
    // Intentionally different key orders — exercises deepEqual's
    // key-order-insensitive comparison (the meaningful case here).
    expect(
      deepEqual(
        { manifest: "package.json", root: "skills" },
        { manifest: "package.json", root: "skills" },
      ),
    ).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("sameSet / valuesEqual", () => {
  it("treats issueKeys order-insensitively but other arrays order-sensitively", () => {
    expect(sameSet(["ABC", "XYZ"], ["XYZ", "ABC"])).toBe(true);
    expect(valuesEqual("issueKeys", ["ABC", "XYZ"], ["XYZ", "ABC"])).toBe(true);
    expect(
      valuesEqual("packageRoots", ["apps", "packages"], ["packages", "apps"]),
    ).toBe(false);
  });

  it("compares as true sets — duplicates don't mask a difference", () => {
    expect(sameSet(["ABC", "ABC"], ["ABC", "XYZ"])).toBe(false);
    expect(sameSet(["ABC", "XYZ"], ["XYZ", "ABC", "XYZ"])).toBe(true);
  });
});

describe("classifyKey", () => {
  it("inferred — missing value, detector available", () => {
    expect(
      classifyKey("baseBranch", "main", undefined, detected("develop")),
    ).toEqual({
      status: "inferred",
      write: "develop",
    });
  });

  it("needs-manual-input — missing value, no detector", () => {
    expect(classifyKey("linearTeamName", "Your Team", undefined, null)).toEqual(
      {
        status: "needs-manual-input",
      },
    );
  });

  it("unchanged — existing value equals detected", () => {
    expect(classifyKey("baseBranch", "main", "main", detected("main"))).toEqual(
      {
        status: "unchanged",
      },
    );
  });

  it("inferred — existing value is still the example placeholder, overwrite", () => {
    expect(
      classifyKey(
        "linearWorkspaceSlug",
        "your-workspace-slug",
        "your-workspace-slug",
        detected("rheged-studio"),
      ),
    ).toEqual({ status: "inferred", write: "rheged-studio" });
  });

  it("needs-manual-input — placeholder kept when no detector", () => {
    expect(
      classifyKey(
        "linearTeamName",
        "Your Linear Team",
        "Your Linear Team",
        null,
      ),
    ).toEqual({ keep: "Your Linear Team", status: "needs-manual-input" });
  });

  it("drift — deliberate edit differing from both example and detected", () => {
    expect(
      classifyKey("baseBranch", "main", "trunk", detected("main")),
    ).toEqual({
      detected: "main",
      keep: "trunk",
      status: "drift",
    });
  });

  it("manual-kept — real value, no detector", () => {
    expect(classifyKey("customKey", "placeholder", "real-value", null)).toEqual(
      {
        keep: "real-value",
        status: "manual-kept",
      },
    );
  });

  it("issueKeys reordered is unchanged, not drift", () => {
    expect(
      classifyKey(
        "issueKeys",
        ["ABC"],
        ["XYZ", "ABC"],
        detected(["ABC", "XYZ"]),
      ),
    ).toEqual({ status: "unchanged" });
  });
});

// A `detect` factory for mergeConfig's tests. Module-scoped because it closes
// over nothing (unicorn/consistent-function-scoping).
function detect(facts: Record<string, unknown> = {}) {
  return (key: string) => {
    const table: Record<string, unknown> = {
      baseBranch: "main",
      issueKeys: ["DEF", "GHI"],
      ...facts,
    };
    return key in table ? { value: table[key] } : null;
  };
}

describe("mergeConfig", () => {
  const example = {
    baseBranch: "main",
    issueKeys: ["ABC", "XYZ"],
    linearTeamName: "Your Linear Team",
  };

  it("fills inferred keys, keeps drift, flags manual input", () => {
    const config = {
      baseBranch: "trunk", // deliberate edit → drift
      issueKeys: ["ABC", "XYZ"], // placeholder → inferred
      // linearTeamName absent, no fact → needs-manual-input
    };
    const { changed, data, results } = mergeConfig({
      config,
      detect: detect(),
      example,
    });
    expect(results.baseBranch.status).toBe("drift");
    expect(results.issueKeys.status).toBe("inferred");
    expect(results.linearTeamName.status).toBe("needs-manual-input");
    expect(data.baseBranch).toBe("trunk"); // drift preserved
    expect(data.issueKeys).toEqual(["DEF", "GHI"]);
    expect(changed).toBe(true);
  });

  it("injects Linear facts as the detected value", () => {
    const config = {};
    const { data, results } = mergeConfig({
      config,
      detect: detect({ linearTeamName: "Rheged Studio" }),
      example,
    });
    expect(results.linearTeamName.status).toBe("inferred");
    expect(data.linearTeamName).toBe("Rheged Studio");
  });

  it("acceptDrift overwrites a drifted key with the detected value", () => {
    const config = { baseBranch: "trunk" };
    const { data, results } = mergeConfig({
      acceptDrift: ["baseBranch"],
      config,
      detect: detect(),
      example,
    });
    expect(results.baseBranch.status).toBe("inferred");
    expect(data.baseBranch).toBe("main");
  });

  it("keeps a consumer-added unknown key untouched", () => {
    const config = { extraThing: 42 };
    const { data, results } = mergeConfig({
      config,
      detect: detect(),
      example,
    });
    expect(results.extraThing.status).toBe("unknown-kept");
    expect(data.extraThing).toBe(42);
  });

  it("is idempotent — a second merge writes nothing", () => {
    const config = {};
    const first = mergeConfig({
      config,
      detect: detect({ linearTeamName: "ACME" }),
      example,
    });
    expect(first.changed).toBe(true);
    const second = mergeConfig({
      config: first.data,
      detect: detect({ linearTeamName: "ACME" }),
      example,
    });
    expect(second.changed).toBe(false);
    expect(second.data).toEqual(first.data);
    for (const result of Object.values(second.results)) {
      expect(["unchanged", "unknown-kept", "manual-kept"]).toContain(
        result.status,
      );
    }
  });

  describe("--set overrides", () => {
    it("applies a set override and records the replaced value in `from`", () => {
      const config = { baseBranch: "trunk" };
      const { changed, data, results } = mergeConfig({
        config,
        detect: detect(),
        example,
        set: { baseBranch: "release/2.0" },
      });
      expect(results.baseBranch).toEqual({
        from: "trunk",
        status: "set",
        write: "release/2.0",
      });
      expect(data.baseBranch).toBe("release/2.0");
      expect(changed).toBe(true);
    });

    it("wins over a detection-inferred value for the same key", () => {
      // issueKeys would otherwise be inferred to the detected ["DEF","GHI"].
      const config = { issueKeys: ["ABC", "XYZ"] };
      const { data, results } = mergeConfig({
        config,
        detect: detect(),
        example,
        set: { issueKeys: ["ONLY"] },
      });
      expect(results.issueKeys.status).toBe("set");
      expect(data.issueKeys).toEqual(["ONLY"]);
    });

    it("omits `from` when the key was previously unset", () => {
      const { data, results } = mergeConfig({
        config: {},
        detect: detect(),
        example,
        set: { linearTeamName: "Rheged Studio" },
      });
      expect(results.linearTeamName).toEqual({
        status: "set",
        write: "Rheged Studio",
      });
      expect(data.linearTeamName).toBe("Rheged Studio");
    });

    it("writes a reordered set-key override exactly, not order-insensitively", () => {
      // issueKeys is a SET_KEY (order-insensitive for drift detection), but an
      // explicit --set is authoritative: a reorder is a real, requested change,
      // so it must persist the exact order given — not silently keep the old one
      // while the report claims the new value.
      const { changed, data, results } = mergeConfig({
        config: { issueKeys: ["ABC", "XYZ"] },
        detect: detect(),
        example,
        set: { issueKeys: ["XYZ", "ABC"] },
      });
      expect(results.issueKeys.status).toBe("set");
      expect(data.issueKeys).toEqual(["XYZ", "ABC"]);
      expect(changed).toBe(true);
    });

    it("stays a no-op when the set value already matches (idempotent)", () => {
      // A config detection would leave untouched (baseBranch + issueKeys already
      // equal the detected values, linearTeamName is a manual-kept edit), so the
      // only candidate write is the --set — which repeats the existing value and
      // must therefore leave `changed` false.
      const { changed, results } = mergeConfig({
        config: {
          baseBranch: "main",
          issueKeys: ["DEF", "GHI"],
          linearTeamName: "Rheged Studio",
        },
        detect: detect(),
        example,
        set: { baseBranch: "main" },
      });
      expect(results.baseBranch.status).toBe("set");
      expect(changed).toBe(false);
    });

    it("omits `from` for a key detection inferred but the config never held", () => {
      // The documented "live detector + --set" case: issueKeys is absent from the
      // config, so detection infers ["DEF","GHI"] into `data` *before* the --set
      // loop runs. `from`/`had` must reflect the original config (here: unset →
      // `from` omitted), not the in-run inferred value already sitting in `data`.
      const { changed, data, results } = mergeConfig({
        config: {}, // issueKeys unset — detection infers ["DEF","GHI"]
        detect: detect(),
        example,
        set: { issueKeys: ["ONLY"] },
      });
      expect(results.issueKeys).toEqual({
        status: "set",
        write: ["ONLY"],
      });
      expect("from" in results.issueKeys).toBe(false);
      expect(data.issueKeys).toEqual(["ONLY"]);
      expect(changed).toBe(true);
    });

    it("records the original placeholder in `from`, not the value detection was about to infer", () => {
      // issueKeys holds the example placeholder, so classifyKey infers
      // ["DEF","GHI"] into `data` first. A same-key --set must report the *original*
      // placeholder as `from`, not that inferred value.
      const { results } = mergeConfig({
        config: { issueKeys: ["ABC", "XYZ"] }, // example placeholder
        detect: detect(),
        example,
        set: { issueKeys: ["ONLY"] },
      });
      expect(results.issueKeys).toEqual({
        from: ["ABC", "XYZ"],
        status: "set",
        write: ["ONLY"],
      });
    });

    it("recomputes changed=false when a --set restores a detector-inferred key to its original value", () => {
      // Regression (A-728): detection infers ["DEF","GHI"] into `data` for the
      // placeholder issueKeys, then a --set restores the original ["ABC","XYZ"].
      // The intermediate inferred write is undone, so the net result equals the
      // original config and `changed` must be false — not stuck true from the
      // inferred write. Isolated to a single key so no other example key writes.
      const { changed, data, results } = mergeConfig({
        config: { issueKeys: ["ABC", "XYZ"] },
        detect: (key) =>
          key === "issueKeys" ? { value: ["DEF", "GHI"] } : null,
        example: { issueKeys: ["ABC", "XYZ"] },
        set: { issueKeys: ["ABC", "XYZ"] },
      });
      expect(results.issueKeys.status).toBe("set");
      expect(data.issueKeys).toEqual(["ABC", "XYZ"]);
      expect(changed).toBe(false);
    });
  });

  // A-813: packageRoots must not flag needs-manual-input when the monorepo gate
  // is off — the placeholder stays, unused at runtime, so the single→mono flip
  // can still infer when a workspace appears later.
  describe("gated packageRoots (A-813)", () => {
    const changelogExample = {
      affectedPackages: true,
      fallbackPackage: "infrastructure",
      packageRoots: ["apps", "packages", "services"],
    };

    it("single-package: packageRoots stays unchanged, not needs-manual-input", () => {
      const { changed, data, results } = mergeConfig({
        config: {
          affectedPackages: true, // still the example placeholder → inferred false
          fallbackPackage: "infrastructure",
          packageRoots: ["apps", "packages", "services"],
        },
        detect: (key) => {
          if (key === "affectedPackages") {
            return { value: false };
          }

          if (key === "fallbackPackage") {
            return { value: "infrastructure" };
          }

          // packageRoots undetectable on a single-package host
          return null;
        },
        example: changelogExample,
      });
      expect(results.affectedPackages.status).toBe("inferred");
      expect(data.affectedPackages).toBe(false);
      expect(results.packageRoots.status).toBe("unchanged");
      expect(data.packageRoots).toEqual(["apps", "packages", "services"]);
      expect(changed).toBe(true); // affectedPackages flipped false
    });

    it("single-package with missing packageRoots: still not needs-manual-input", () => {
      const { results } = mergeConfig({
        config: {},
        detect: (key) =>
          key === "affectedPackages"
            ? { value: false }
            : key === "fallbackPackage"
              ? { value: "infrastructure" }
              : null,
        example: changelogExample,
      });
      expect(results.affectedPackages.write).toBe(false);
      expect(results.packageRoots.status).toBe("unchanged");
    });

    it("monorepo: still infers packageRoots and affectedPackages true", () => {
      const { data, results } = mergeConfig({
        config: {
          affectedPackages: true,
          fallbackPackage: "infrastructure",
          packageRoots: ["apps", "packages", "services"],
        },
        detect: (key) => {
          if (key === "affectedPackages") {
            return { value: true };
          }

          if (key === "fallbackPackage") {
            return { value: "infrastructure" };
          }

          if (key === "packageRoots") {
            return { value: ["packages"] };
          }

          return null;
        },
        example: changelogExample,
      });
      expect(results.affectedPackages.status).toBe("unchanged");
      expect(results.packageRoots.status).toBe("inferred");
      expect(data.packageRoots).toEqual(["packages"]);
      expect(data.affectedPackages).toBe(true);
    });

    it("placeholder→workspace: packageRoots still upgrades via ours-equals-base", () => {
      // After a single-package reconcile, affectedPackages is the real value
      // `false` (drift when a workspace appears — never-clobber) while
      // packageRoots is still the example placeholder and must infer.
      const { data, results } = mergeConfig({
        config: {
          affectedPackages: false,
          fallbackPackage: "infrastructure",
          packageRoots: ["apps", "packages", "services"],
        },
        detect: (key) => {
          if (key === "affectedPackages") {
            return { value: true };
          }

          if (key === "fallbackPackage") {
            return { value: "infrastructure" };
          }

          if (key === "packageRoots") {
            return { value: ["apps", "packages"] };
          }

          return null;
        },
        example: changelogExample,
      });
      expect(results.affectedPackages.status).toBe("drift");
      expect(data.affectedPackages).toBe(false);
      expect(results.packageRoots.status).toBe("inferred");
      expect(data.packageRoots).toEqual(["apps", "packages"]);
    });

    it("placeholder→workspace: acceptDrift flips the gate on", () => {
      const { data, results } = mergeConfig({
        acceptDrift: ["affectedPackages"],
        config: {
          affectedPackages: false,
          fallbackPackage: "infrastructure",
          packageRoots: ["apps", "packages", "services"],
        },
        detect: (key) => {
          if (key === "affectedPackages") {
            return { value: true };
          }

          if (key === "fallbackPackage") {
            return { value: "infrastructure" };
          }

          if (key === "packageRoots") {
            return { value: ["apps", "packages"] };
          }

          return null;
        },
        example: changelogExample,
      });
      expect(results.affectedPackages.status).toBe("inferred");
      expect(data.affectedPackages).toBe(true);
      expect(results.packageRoots.status).toBe("inferred");
      expect(data.packageRoots).toEqual(["apps", "packages"]);
    });

    it("--set affectedPackages=false silences packageRoots needs-manual-input", () => {
      const { results } = mergeConfig({
        config: {
          affectedPackages: true,
          packageRoots: ["apps", "packages", "services"],
        },
        detect: (key) => {
          // Simulate a monorepo detector that would keep the gate on — --set wins.
          if (key === "affectedPackages") {
            return { value: true };
          }

          // packageRoots (and everything else) undetectable
          return null;
        },
        example: changelogExample,
        set: { affectedPackages: false },
      });
      expect(results.affectedPackages.status).toBe("set");
      expect(results.packageRoots.status).toBe("unchanged");
    });
  });
});
