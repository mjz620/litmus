import {
  deserializeLabDraft,
  serializeLabDraft
} from "../../../lab-workflows/authoring";
import {
  validatedLabWorkflowSpecV2Schema,
  type LabWorkflowDraftV2,
  type ValidatedLabWorkflowSpecV2
} from "../../../lab-workflows/schema/v2";

export const LOCAL_LAB_DRAFT_KEY_PREFIX = "labbench.composer.draft.v1:";
export const LOCAL_LAB_PREVIEW_KEY_PREFIX = "labbench.composer.preview.v1:";
export const LOCAL_LAB_PREVIEW_SCHEMA_VERSION = "1.0.0" as const;

export interface ComposerStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export interface LabDraftRepository {
  list(): readonly string[];
  save(name: string, draft: unknown): void;
  load(name: string): Readonly<LabWorkflowDraftV2> | null;
  remove(name: string): void;
}

export interface LabPreviewRepository {
  save(spec: unknown): void;
  load(canonicalSpecHash: string): Readonly<ValidatedLabWorkflowSpecV2> | null;
}

function assertName(name: string): string {
  const trimmed = name.trim();
  if (
    trimmed.length < 1 ||
    trimmed.length > 80 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/.test(trimmed)
  ) {
    throw new TypeError(
      "Draft names must be 1–80 letters, numbers, spaces, dots, dashes, or underscores."
    );
  }
  return trimmed;
}

function draftKey(name: string): string {
  return `${LOCAL_LAB_DRAFT_KEY_PREFIX}${encodeURIComponent(assertName(name))}`;
}

function previewKey(hash: string): string {
  return `${LOCAL_LAB_PREVIEW_KEY_PREFIX}${encodeURIComponent(hash)}`;
}

export class LocalLabDraftRepository implements LabDraftRepository {
  constructor(private readonly storage: ComposerStorage) {}

  list(): readonly string[] {
    const names: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(LOCAL_LAB_DRAFT_KEY_PREFIX)) continue;
      const encoded = key.slice(LOCAL_LAB_DRAFT_KEY_PREFIX.length);
      try {
        names.push(assertName(decodeURIComponent(encoded)));
      } catch {
        // Ignore malformed foreign keys; load remains strict for named records.
      }
    }
    return Object.freeze([...new Set(names)].sort());
  }

  save(name: string, draft: unknown): void {
    this.storage.setItem(draftKey(name), serializeLabDraft(draft));
  }

  load(name: string): Readonly<LabWorkflowDraftV2> | null {
    const serialized = this.storage.getItem(draftKey(name));
    return serialized === null ? null : deserializeLabDraft(serialized);
  }

  remove(name: string): void {
    this.storage.removeItem(draftKey(name));
  }
}

export class LocalLabPreviewRepository implements LabPreviewRepository {
  constructor(private readonly storage: ComposerStorage) {}

  save(input: unknown): void {
    const spec = validatedLabWorkflowSpecV2Schema.parse(input);
    this.storage.setItem(
      previewKey(spec.validation.canonicalSpecHash),
      JSON.stringify({
        schemaVersion: LOCAL_LAB_PREVIEW_SCHEMA_VERSION,
        spec
      })
    );
  }

  load(canonicalSpecHash: string): Readonly<ValidatedLabWorkflowSpecV2> | null {
    const serialized = this.storage.getItem(previewKey(canonicalSpecHash));
    if (serialized === null) return null;
    const parsed = JSON.parse(serialized) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Object.keys(parsed).length !== 2 ||
      !("schemaVersion" in parsed) ||
      parsed.schemaVersion !== LOCAL_LAB_PREVIEW_SCHEMA_VERSION ||
      !("spec" in parsed)
    ) {
      throw new TypeError("Serialized Lab Composer preview is invalid.");
    }
    const spec = validatedLabWorkflowSpecV2Schema.parse(parsed.spec);
    if (spec.validation.canonicalSpecHash !== canonicalSpecHash) {
      throw new TypeError("Saved preview hash does not match its storage key.");
    }
    return Object.freeze(spec);
  }
}
