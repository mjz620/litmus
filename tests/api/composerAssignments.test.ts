import { describe, expect, it, vi } from "vitest";

import { createAssignmentsHandler } from "../../src/app/api/lab-composer/assignments/route";

const TEACHER_ID = "10000000-0000-4000-8000-000000000001";
const STUDENT_ID = "10000000-0000-4000-8000-000000000002";
const CLASS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION_ID = "30000000-0000-4000-8000-000000000001";
const ASSIGN_KEY = "77777777-7777-4777-8777-777777777777";

const teacher = { userId: TEACHER_ID, role: "teacher" as const };
const student = { userId: STUDENT_ID, role: "student" as const };

const assignmentRecord = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  classId: CLASS_ID,
  labDefinitionVersionId: VERSION_ID,
  title: "Pinned lab"
};

describe("GET/POST /api/lab-composer/assignments", () => {
  it("creates a teacher assignment for an approved version", async () => {
    const createAssignment = vi.fn().mockResolvedValue(assignmentRecord);
    const handler = createAssignmentsHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: {
        createAssignment,
        listForClass: vi.fn()
      }
    });

    const response = await handler(
      new Request("http://localhost/api/lab-composer/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: ASSIGN_KEY,
          classId: CLASS_ID,
          versionId: VERSION_ID,
          title: "Pinned lab"
        })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      assignment: assignmentRecord
    });
    expect(createAssignment).toHaveBeenCalledWith(TEACHER_ID, {
      idempotencyKey: ASSIGN_KEY,
      classId: CLASS_ID,
      versionId: VERSION_ID,
      title: "Pinned lab"
    });
  });

  it("lists class assignments and rejects student create", async () => {
    const listForClass = vi.fn().mockResolvedValue([assignmentRecord]);
    const createAssignment = vi.fn();
    const handler = createAssignmentsHandler({
      authenticate: vi.fn().mockResolvedValue(student),
      service: { createAssignment, listForClass }
    });

    const listed = await handler(
      new Request(
        `http://localhost/api/lab-composer/assignments?classId=${CLASS_ID}`
      )
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      ok: true,
      assignments: [assignmentRecord]
    });

    const created = await handler(
      new Request("http://localhost/api/lab-composer/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: ASSIGN_KEY,
          classId: CLASS_ID,
          versionId: VERSION_ID,
          title: "Pinned lab"
        })
      })
    );
    expect(created.status).toBe(403);
    expect(createAssignment).not.toHaveBeenCalled();
  });
});
