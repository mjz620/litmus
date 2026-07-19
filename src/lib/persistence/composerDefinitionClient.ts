import type { LabWorkflowDraftV2 } from "../../lab-workflows/schema/v2";
import type { PersistedLabAssignment } from "./labAssignmentRepository";
import type {
  PersistedLabDefinitionDraft,
  PersistedLabDefinitionVersion
} from "./labDefinitionRepository";

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function failureMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return fallback;
}

export async function listComposerDrafts(): Promise<
  readonly PersistedLabDefinitionDraft[]
> {
  const response = await fetch("/api/lab-composer/definitions/drafts", {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(body, "Could not list server drafts."));
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("drafts" in body) ||
    !Array.isArray(body.drafts)
  ) {
    throw new Error("Server draft list was malformed.");
  }
  return body.drafts as PersistedLabDefinitionDraft[];
}

export async function saveComposerDraft(input: {
  readonly idempotencyKey: string;
  readonly draftId?: string;
  readonly expectedStorageRevision?: number;
  readonly name: string;
  readonly draft: Readonly<LabWorkflowDraftV2>;
}): Promise<Readonly<PersistedLabDefinitionDraft>> {
  const response = await fetch("/api/lab-composer/definitions/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(body, "Could not save the server draft."));
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("draft" in body) ||
    typeof body.draft !== "object" ||
    body.draft === null
  ) {
    throw new Error("Server draft save response was malformed.");
  }
  return body.draft as PersistedLabDefinitionDraft;
}

export async function approveComposerDraft(input: {
  readonly draftId: string;
  readonly idempotencyKey: string;
  readonly expectedStorageRevision?: number;
  readonly expectedCanonicalHash?: string;
}): Promise<Readonly<PersistedLabDefinitionVersion>> {
  const response = await fetch(
    `/api/lab-composer/definitions/drafts/${input.draftId}/approve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        expectedStorageRevision: input.expectedStorageRevision,
        expectedCanonicalHash: input.expectedCanonicalHash
      })
    }
  );
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(body, "Could not approve the lab."));
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("version" in body) ||
    typeof body.version !== "object" ||
    body.version === null
  ) {
    throw new Error("Server approval response was malformed.");
  }
  return body.version as PersistedLabDefinitionVersion;
}

export async function listComposerVersions(): Promise<
  readonly PersistedLabDefinitionVersion[]
> {
  const response = await fetch("/api/lab-composer/definitions/versions", {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(body, "Could not list approved versions."));
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("versions" in body) ||
    !Array.isArray(body.versions)
  ) {
    throw new Error("Server version list was malformed.");
  }
  return body.versions as PersistedLabDefinitionVersion[];
}

export async function createComposerAssignment(input: {
  readonly idempotencyKey: string;
  readonly classId: string;
  readonly versionId: string;
  readonly title: string;
  readonly dueAt?: string;
}): Promise<Readonly<PersistedLabAssignment>> {
  const response = await fetch("/api/lab-composer/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input)
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(body, "Could not assign the lab."));
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("assignment" in body) ||
    typeof body.assignment !== "object" ||
    body.assignment === null
  ) {
    throw new Error("Server assignment response was malformed.");
  }
  return body.assignment as PersistedLabAssignment;
}

export interface TeacherClassSummary {
  readonly id: string;
  readonly name: string;
}

export async function listTeacherClasses(): Promise<
  readonly TeacherClassSummary[]
> {
  const response = await fetch("/api/teacher/classes", {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(failureMessage(body, "Could not list classes."));
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("classes" in body) ||
    !Array.isArray(body.classes)
  ) {
    throw new Error("Class list was malformed.");
  }
  return body.classes as TeacherClassSummary[];
}
