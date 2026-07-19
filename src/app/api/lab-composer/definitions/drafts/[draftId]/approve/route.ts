import { NextResponse } from "next/server";

import {
  authenticateComposerPrincipal,
  createLabDefinitionPersistenceService,
  type ComposerAuthPrincipal
} from "../../../../../../../lib/persistence/labDefinitionApi";
import {
  LAB_DEFINITION_PERSISTENCE_ERROR_CODES,
  LabDefinitionPersistenceError,
  labDefinitionApprovalRequestSchema,
  type LabDefinitionPersistenceService
} from "../../../../../../../lib/persistence/labDefinitionRepository";

interface ApprovalService {
  approveDraft: LabDefinitionPersistenceService["approveDraft"];
}

interface ApprovalHandlerDependencies {
  readonly authenticate: () => Promise<ComposerAuthPrincipal | null>;
  readonly service: ApprovalService;
}

interface ApprovalRouteContext {
  readonly params: Promise<{ draftId: string }>;
}

function failure(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function persistenceFailure(error: unknown) {
  if (error instanceof LabDefinitionPersistenceError) {
    switch (error.code) {
      case LAB_DEFINITION_PERSISTENCE_ERROR_CODES.invalidSpec:
        return failure(400, "Invalid lab approval request.");
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

export function createDraftApprovalHandler({
  authenticate,
  service
}: ApprovalHandlerDependencies) {
  return async function draftApprovalHandler(
    request: Request,
    context: ApprovalRouteContext
  ) {
    let principal: ComposerAuthPrincipal | null;
    try {
      principal = await authenticate();
    } catch {
      return failure(503, "Authentication is unavailable.");
    }
    if (!principal) return failure(401, "Authentication required.");
    if (principal.role !== "teacher")
      return failure(403, "Teacher access required.");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure(400, "Invalid JSON body.");
    }
    const parsed = labDefinitionApprovalRequestSchema.safeParse(body);
    if (!parsed.success) return failure(400, "Invalid lab approval request.");
    const { draftId } = await context.params;
    try {
      const version = await service.approveDraft(
        principal.userId,
        draftId,
        parsed.data
      );
      return NextResponse.json({ ok: true, version });
    } catch (error) {
      return persistenceFailure(error);
    }
  };
}

export async function POST(request: Request, context: ApprovalRouteContext) {
  return createDraftApprovalHandler({
    authenticate: authenticateComposerPrincipal,
    service: {
      approveDraft: (ownerId, draftId, body) =>
        createLabDefinitionPersistenceService().approveDraft(
          ownerId,
          draftId,
          body
        )
    }
  })(request, context);
}
