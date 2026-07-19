import { NextResponse } from "next/server";

import {
  authenticateComposerPrincipal,
  createLabDefinitionPersistenceService,
  type ComposerAuthPrincipal
} from "../../../../../lib/persistence/labDefinitionApi";
import type { LabDefinitionPersistenceService } from "../../../../../lib/persistence/labDefinitionRepository";

interface VersionsHandlerDependencies {
  readonly authenticate: () => Promise<ComposerAuthPrincipal | null>;
  readonly service: Pick<LabDefinitionPersistenceService, "listVersions">;
}

function failure(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export function createVersionsHandler({
  authenticate,
  service
}: VersionsHandlerDependencies) {
  return async function versionsHandler(request: Request) {
    if (request.method !== "GET") return failure(405, "Method not allowed.");
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
      const versions = await service.listVersions(principal.userId);
      return NextResponse.json({ ok: true, versions });
    } catch {
      return failure(503, "Lab definition persistence is unavailable.");
    }
  };
}

export async function GET(request: Request) {
  return createVersionsHandler({
    authenticate: authenticateComposerPrincipal,
    service: {
      listVersions: (ownerId) =>
        createLabDefinitionPersistenceService().listVersions(ownerId)
    }
  })(request);
}
