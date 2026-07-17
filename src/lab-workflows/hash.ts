import { createHash } from "node:crypto";

import { labWorkflowSpecSchema, type LabWorkflowSpec } from "./schema";

export const LAB_WORKFLOW_HASH_ALGORITHM = "sha256" as const;

const EXCLUDED_ROOT_FIELDS = new Set([
  "supportStatus",
  "validation",
  "judgeCritique"
]);

export type HashableLabWorkflowSpec = Omit<
  LabWorkflowSpec,
  "supportStatus" | "validation" | "judgeCritique"
>;

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
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
): HashableLabWorkflowSpec {
  const parsed = labWorkflowSpecSchema.parse(input);
  return Object.fromEntries(
    Object.entries(parsed).filter(([key]) => !EXCLUDED_ROOT_FIELDS.has(key))
  ) as HashableLabWorkflowSpec;
}

export function canonicalizeLabWorkflowSpec(input: unknown): string {
  return canonicalJson(getHashableLabWorkflowSpec(input), "$");
}

export function hashLabWorkflowSpec(input: unknown): string {
  const canonicalSpec = canonicalizeLabWorkflowSpec(input);
  return `${LAB_WORKFLOW_HASH_ALGORITHM}:${createHash(
    LAB_WORKFLOW_HASH_ALGORITHM
  )
    .update(canonicalSpec, "utf8")
    .digest("hex")}`;
}

export function labWorkflowHashMatches(
  input: unknown,
  expectedHash: string
): boolean {
  return hashLabWorkflowSpec(input) === expectedHash;
}
