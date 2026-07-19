import { describe, expect, it } from "vitest";

import {
  LOCAL_LAB_DRAFT_KEY_PREFIX,
  LOCAL_LAB_PREVIEW_KEY_PREFIX,
  LocalLabDraftRepository,
  LocalLabPreviewRepository,
  type ComposerStorage
} from "../../src/components/teacher/lab-composer/localRepository";
import { NATIVE_TITRATION_V2_DRAFT } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { validateSolutionPreparationV2 } from "../../src/lab-workflows/definitions/solution-preparation";
import { migrateLabWorkflowV2_0ToV2_1 } from "../../src/lab-workflows/schema/migration";
import { labWorkflowDraftV2_1Schema } from "../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../src/lab-workflows/validation";

class MemoryStorage implements ComposerStorage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
}

describe("local Lab Composer repositories", () => {
  it("strictly saves, lists, loads, and removes versioned drafts", () => {
    const storage = new MemoryStorage();
    const repository = new LocalLabDraftRepository(storage);
    repository.save("Endpoint practice", NATIVE_TITRATION_V2_DRAFT);

    expect(repository.list()).toEqual(["Endpoint practice"]);
    expect(repository.load("Endpoint practice")).toEqual(
      NATIVE_TITRATION_V2_DRAFT
    );
    expect(() =>
      repository.save("../unsafe/name", NATIVE_TITRATION_V2_DRAFT)
    ).toThrowError(/Draft names/);

    storage.setItem(
      `${LOCAL_LAB_DRAFT_KEY_PREFIX}${encodeURIComponent("Broken")}`,
      JSON.stringify({ schemaVersion: "1.0.0", draft: { arbitrary: true } })
    );
    expect(() => repository.load("Broken")).toThrow();
    repository.remove("Endpoint practice");
    expect(repository.load("Endpoint practice")).toBeNull();
  });

  it("autosaves, restores, and clears a single working draft (LC2-410)", () => {
    const storage = new MemoryStorage();
    const repository = new LocalLabDraftRepository(storage);

    // Nothing saved yet.
    expect(repository.loadWorking()).toBeNull();

    repository.saveWorking(NATIVE_TITRATION_V2_DRAFT);
    expect(repository.loadWorking()).toEqual(NATIVE_TITRATION_V2_DRAFT);

    // The working draft is independent of named saves and of the saved list.
    expect(repository.list()).toEqual([]);

    repository.clearWorking();
    expect(repository.loadWorking()).toBeNull();
  });

  it("round-trips a canonical teacher-authored concentration exactly", () => {
    const migrated = migrateLabWorkflowV2_0ToV2_1(NATIVE_TITRATION_V2_DRAFT);
    const authored = labWorkflowDraftV2_1Schema.parse({
      ...migrated,
      materials: [
        {
          ...migrated.materials[0],
          materialProfileId: "reagent.sodium_chloride_aqueous.v1",
          quantityPresetId: "quantity-preset.sodium_chloride_solution_50ml.v1",
          initialization: {
            kind: "bounded_concentration",
            configurationSchemaId:
              "schema.material_initialization.bounded_concentration.v1",
            concentration: {
              decimalValue: "0.375",
              unitId: "unit.mol_per_l.v1"
            }
          }
        },
        ...migrated.materials.slice(1)
      ]
    });
    const storage = new MemoryStorage();
    const repository = new LocalLabDraftRepository(storage);

    repository.save("Custom stock", authored);
    expect(repository.load("Custom stock")).toEqual(authored);
    repository.saveWorking(authored);
    expect(repository.loadWorking()).toEqual(authored);
  });

  it("stores only strict validated previews and rejects stale hash keys", () => {
    const storage = new MemoryStorage();
    const repository = new LocalLabPreviewRepository(storage);
    const outcome = validateLabWorkflowSpecV2(NATIVE_TITRATION_V2_DRAFT, {
      checkedAt: "2026-07-18T08:00:00.000Z"
    });
    if (!outcome.schemaValid) throw new Error("Expected native workflow");
    repository.save(outcome.spec);

    expect(repository.load(outcome.validation.canonicalSpecHash)).toEqual(
      outcome.spec
    );
    const staleHash =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    storage.setItem(
      `${LOCAL_LAB_PREVIEW_KEY_PREFIX}${encodeURIComponent(staleHash)}`,
      JSON.stringify({ schemaVersion: "1.0.0", spec: outcome.spec })
    );
    expect(() => repository.load(staleHash)).toThrowError(/hash/);
    expect(() => repository.save(NATIVE_TITRATION_V2_DRAFT)).toThrow();

    const solution = validateSolutionPreparationV2("2026-07-18T15:00:00.000Z");
    repository.save(solution);
    expect(repository.load(solution.validation.canonicalSpecHash)).toEqual(
      solution
    );
  });
});
