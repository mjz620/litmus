import { NextResponse } from "next/server";

import {
  authenticateComposerPrincipal,
  createLabAssignmentService,
  type ComposerAuthPrincipal
} from "../../../../lib/persistence/labDefinitionApi";
import {
  LAB_ASSIGNMENT_ERROR_CODES,
  LabAssignmentError,
  labAssignmentCreateRequestSchema,
  type LabAssignmentService
} from "../../../../lib/persistence/labAssignmentRepository";

interface AssignmentHandlerDependencies {
  readonly authenticate: () => Promise<ComposerAuthPrincipal | null>;
  readonly service: Pick<LabAssignmentService, "createAssignment" | "listForClass">;
}

function failure(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

function assignmentFailure(error: unknown) {
  if (error instanceof LabAssignmentError) {
    switch (error.code) {
      case LAB_ASSIGNMENT_ERROR_CODES.invalidRequest:
        return failure(400, "Invalid assignment request.");
      case LAB_ASSIGNMENT_ERROR_CODES.notFound:
        return failure(404, "Approved lab definition version not found.");
      case LAB_ASSIGNMENT_ERROR_CODES.unauthorized:
        return failure(403, "Only the class teacher can create assignments.");
      case LAB_ASSIGNMENT_ERROR_CODES.notAssignable:
        return failure(422, "The lab is not eligible for assignment.");
      default:
        break;
    }
  }
  return failure(503, "Assignment persistence is unavailable.");
}

export function createAssignmentsHandler({
  authenticate,
  service
}: AssignmentHandlerDependencies) {
  return async function assignmentsHandler(request: Request) {
    let principal: ComposerAuthPrincipal | null;
    try {
      principal = await authenticate();
    } catch {
      return failure(503, "Authentication is unavailable.");
    }
    if (!principal) return failure(401, "Authentication required.");

    try {
      if (request.method === "GET") {
        const classId = new URL(request.url).searchParams.get("classId");
        if (!classId) return failure(400, "classId is required.");
        // classId is caller-supplied, so access is checked against the principal.
        const assignments = await service.listForClass(
          classId,
          principal.userId
        );
        return NextResponse.json({ ok: true, assignments });
      }
      if (request.method !== "POST") return failure(405, "Method not allowed.");
      if (principal.role !== "teacher")
        return failure(403, "Teacher access required.");

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return failure(400, "Invalid JSON body.");
      }
      const parsed = labAssignmentCreateRequestSchema.safeParse(body);
      if (!parsed.success) return failure(400, "Invalid assignment request.");
      const assignment = await service.createAssignment(
        principal.userId,
        parsed.data
      );
      return NextResponse.json({ ok: true, assignment });
    } catch (error) {
      return assignmentFailure(error);
    }
  };
}

function defaultHandler(request: Request) {
  return createAssignmentsHandler({
    authenticate: authenticateComposerPrincipal,
    service: {
      createAssignment: (teacherId, body) =>
        createLabAssignmentService().createAssignment(teacherId, body),
      listForClass: (classId, requesterId) =>
        createLabAssignmentService().listForClass(classId, requesterId)
    }
  })(request);
}

export async function GET(request: Request) {
  return defaultHandler(request);
}

export async function POST(request: Request) {
  return defaultHandler(request);
}
