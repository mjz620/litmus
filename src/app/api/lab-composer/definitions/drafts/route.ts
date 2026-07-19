import { NextResponse } from "next/server";

import {
  authenticateComposerPrincipal,
  createLabDefinitionPersistenceService,
  type ComposerAuthPrincipal
} from "../../../../../lib/persistence/labDefinitionApi";
import {
  LAB_DEFINITION_PERSISTENCE_ERROR_CODES,
  LabDefinitionPersistenceError,
  labDefinitionDraftSaveRequestSchema,
  type LabDefinitionPersistenceService
} from "../../../../../lib/persistence/labDefinitionRepository";

interface DraftService {
  listDrafts: LabDefinitionPersistenceService["listDrafts"];
  saveDraft: LabDefinitionPersistenceService["saveDraft"];
}

interface DraftsHandlerDependencies {
  readonly authenticate: () => Promise<ComposerAuthPrincipal | null>;
  readonly service: DraftService;
}

function failure(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function persistenceFailure(error: unknown) {
  if (error instanceof LabDefinitionPersistenceError) {
    switch (error.code) {
      case LAB_DEFINITION_PERSISTENCE_ERROR_CODES.invalidSpec:
        return failure(400, "Invalid lab definition request.");
      case LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notFound:
        return failure(404, "Lab draft not found.");
      case LAB_DEFINITION_PERSISTENCE_ERROR_CODES.revisionConflict:
        return failure(409, "The lab draft changed after it was loaded.");
      case LAB_DEFINITION_PERSISTENCE_ERROR_CODES.notRunnable:
        return failure(422, "The lab is not eligible for approval.");
      default:
        break;
    }
  }
  return failure(503, "Lab definition persistence is unavailable.");
}

export function createDraftsHandler({
  authenticate,
  service
}: DraftsHandlerDependencies) {
  return async function draftsHandler(request: Request) {
    let principal: ComposerAuthPrincipal | null;
    try {
      principal = await authenticate();
    } catch {
      return failure(503, "Authentication is unavailable.");
    }
    if (!principal) return failure(401, "Authentication required.");
    if (principal.role !== "teacher")
      return failure(403, "Teacher access required.");

    try {
      if (request.method === "GET") {
        const drafts = await service.listDrafts(principal.userId);
        return NextResponse.json({ ok: true, drafts });
      }
      if (request.method !== "POST") return failure(405, "Method not allowed.");

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return failure(400, "Invalid JSON body.");
      }
      const parsed = labDefinitionDraftSaveRequestSchema.safeParse(body);
      if (!parsed.success)
        return failure(400, "Invalid lab definition request.");
      const draft = await service.saveDraft(principal.userId, parsed.data);
      return NextResponse.json({ ok: true, draft });
    } catch (error) {
      return persistenceFailure(error);
    }
  };
}

function defaultHandler(request: Request) {
  return createDraftsHandler({
    authenticate: authenticateComposerPrincipal,
    service: {
      listDrafts: (ownerId) =>
        createLabDefinitionPersistenceService().listDrafts(ownerId),
      saveDraft: (ownerId, body) =>
        createLabDefinitionPersistenceService().saveDraft(ownerId, body)
    }
  })(request);
}

export async function GET(request: Request) {
  return defaultHandler(request);
}

export async function POST(request: Request) {
  return defaultHandler(request);
}
