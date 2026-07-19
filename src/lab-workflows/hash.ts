import type { LabWorkflowSpecV1 } from "./schema";
import {
  versionedLabWorkflowSpecSchema,
  type LabWorkflowSpecV2
} from "./schema/v2";
import { sha256Hex } from "./sha256";

export const LAB_WORKFLOW_HASH_ALGORITHM = "sha256" as const;
export const LAB_WORKFLOW_HASH_DOMAIN_V2 =
  "lab-workflow-spec\0schema=2.0.0\0" as const;
export const LAB_WORKFLOW_HASH_DOMAIN_V2_1 =
  "lab-workflow-spec\0schema=2.1.0\0" as const;

const EXCLUDED_ROOT_FIELDS = new Set([
  "supportStatus",
  "validation",
  "judgeCritique"
]);

export type HashableLabWorkflowSpecV1 = Omit<
  LabWorkflowSpecV1,
  "supportStatus" | "validation" | "judgeCritique"
>;
export type HashableLabWorkflowSpecV2 = Omit<
  LabWorkflowSpecV2,
  "supportStatus" | "validation" | "judgeCritique"
>;
export type HashableVersionedLabWorkflowSpec =
  | HashableLabWorkflowSpecV1
  | HashableLabWorkflowSpecV2;
/** Historical compatibility type alias. */
export type HashableLabWorkflowSpec = HashableLabWorkflowSpecV1;

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertJsonData(
  value: unknown,
  path: string,
  activeObjects: Set<object>
): void {
  if (value === null) return;
  switch (typeof value) {
    case "boolean":
    case "string":
      return;
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`Cannot hash non-finite number at ${path}`);
      }
      return;
    case "undefined":
    case "bigint":
    case "function":
    case "symbol":
      throw new TypeError(`Cannot hash ${typeof value} at ${path}`);
    case "object": {
      if (activeObjects.has(value)) {
        throw new TypeError(`Cannot hash cyclic data at ${path}`);
      }
      const prototype = Object.getPrototypeOf(value);
      const isArray = Array.isArray(value);
      if (
        (!isArray && prototype !== Object.prototype && prototype !== null) ||
        (isArray && prototype !== Array.prototype)
      ) {
        throw new TypeError(`Cannot hash non-plain object at ${path}`);
      }

      activeObjects.add(value);
      try {
        if (isArray) {
          const allowedKeys = new Set<string>(["length"]);
          for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, index);
            if (!descriptor) {
              throw new TypeError(
                `Cannot hash sparse array value at ${path}[${index}]`
              );
            }
            if (!descriptor.enumerable || !("value" in descriptor)) {
              throw new TypeError(
                `Cannot hash hidden or accessor array value at ${path}[${index}]`
              );
            }
            allowedKeys.add(String(index));
            assertJsonData(
              descriptor.value,
              `${path}[${index}]`,
              activeObjects
            );
          }
          for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== "string" || !allowedKeys.has(key)) {
              throw new TypeError(
                `Cannot hash custom array property at ${path}`
              );
            }
          }
          return;
        }

        for (const key of Reflect.ownKeys(value)) {
          if (typeof key !== "string") {
            throw new TypeError(`Cannot hash symbol-keyed property at ${path}`);
          }
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (
            !descriptor ||
            !descriptor.enumerable ||
            !("value" in descriptor)
          ) {
            throw new TypeError(
              `Cannot hash hidden or accessor property at ${path}.${key}`
            );
          }
          assertJsonData(descriptor.value, `${path}.${key}`, activeObjects);
        }
      } finally {
        activeObjects.delete(value);
      }
    }
  }
}

function canonicalJson(value: unknown, path: string): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number": {
      if (!Number.isFinite(value)) {
        throw new TypeError(`Cannot canonicalize non-finite number at ${path}`);
      }
      return JSON.stringify(value);
    }
    case "string":
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) {
        return `[${value
          .map((item, index) => {
            if (item === undefined) {
              throw new TypeError(
                `Cannot canonicalize undefined array value at ${path}[${index}]`
              );
            }
            return canonicalJson(item, `${path}[${index}]`);
          })
          .join(",")}]`;
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`Cannot canonicalize non-plain object at ${path}`);
      }

      const entries = Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => compareCodeUnits(left, right));
      return `{${entries
        .map(
          ([key, child]) =>
            `${JSON.stringify(key)}:${canonicalJson(child, `${path}.${key}`)}`
        )
        .join(",")}}`;
    }
    default:
      throw new TypeError(`Cannot canonicalize ${typeof value} at ${path}`);
  }
}

/**
 * Returns the exact workflow payload covered by validation artifacts.
 *
 * Validator status/result and Judge critique are excluded because they are
 * derived artifacts bound to this hash. All other fields are included and array
 * order is preserved because procedure and presentation order can be meaningful.
 */
export function getHashableLabWorkflowSpec(
  input: unknown
): HashableVersionedLabWorkflowSpec {
  if (typeof input === "object" && input !== null) {
    const versionDescriptor = Object.getOwnPropertyDescriptor(
      input,
      "schemaVersion"
    );
    if (
      !versionDescriptor ||
      !versionDescriptor.enumerable ||
      !("value" in versionDescriptor)
    ) {
      throw new TypeError(
        "Cannot hash a workflow without an enumerable data schemaVersion"
      );
    }
    if (
      versionDescriptor.value === "2.0.0" ||
      versionDescriptor.value === "2.1.0"
    ) {
      assertJsonData(input, "$", new Set());
    }
  }
  const parsed = versionedLabWorkflowSpecSchema.parse(input);
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => !EXCLUDED_ROOT_FIELDS.has(key))
  ) as HashableVersionedLabWorkflowSpec;
}

export function canonicalizeLabWorkflowSpec(input: unknown): string {
  return canonicalJson(getHashableLabWorkflowSpec(input), "$");
}

export function serializeLabWorkflowSpecHashPreimage(input: unknown): string {
  const hashable = getHashableLabWorkflowSpec(input);
  const canonicalSpec = canonicalJson(hashable, "$");
  if (hashable.schemaVersion === "2.0.0")
    return `${LAB_WORKFLOW_HASH_DOMAIN_V2}${canonicalSpec}`;
  if (hashable.schemaVersion === "2.1.0")
    return `${LAB_WORKFLOW_HASH_DOMAIN_V2_1}${canonicalSpec}`;
  return canonicalSpec;
}

export function hashLabWorkflowSpec(input: unknown): string {
  const preimage = serializeLabWorkflowSpecHashPreimage(input);
  return `${LAB_WORKFLOW_HASH_ALGORITHM}:${sha256Hex(preimage)}`;
}

export function labWorkflowHashMatches(
  input: unknown,
  expectedHash: string
): boolean {
  return hashLabWorkflowSpec(input) === expectedHash;
}
