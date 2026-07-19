import { describe, expect, it, vi } from "vitest";

import { createDraftApprovalHandler } from "../../src/app/api/lab-composer/definitions/drafts/[draftId]/approve/route";
import { createDraftsHandler } from "../../src/app/api/lab-composer/definitions/drafts/route";
import { SOLUTION_PREPARATION_V2_DRAFT } from "../../src/lab-workflows/definitions/solution-preparation";

const TEACHER_ID = "10000000-0000-4000-8000-000000000001";
const STUDENT_ID = "10000000-0000-4000-8000-000000000002";
const DRAFT_ID = "20000000-0000-4000-8000-000000000001";
const VERSION_ID = "30000000-0000-4000-8000-000000000001";
const SAVE_KEY = "40000000-0000-4000-8000-000000000001";
const APPROVAL_KEY = "50000000-0000-4000-8000-000000000001";

const teacher = { userId: TEACHER_ID, role: "teacher" as const };
const student = { userId: STUDENT_ID, role: "student" as const };

const draftRecord = {
  id: DRAFT_ID,
  ownerId: TEACHER_ID,
  name: "Solution preparation",
  revision: SOLUTION_PREPARATION_V2_DRAFT.revision,
  updatedAt: "2026-07-19T16:00:00.000Z"
};

const versionRecord = {
  id: VERSION_ID,
  draftId: DRAFT_ID,
  ownerId: TEACHER_ID,
  canonicalSpecHash:
    "sha256:5c6e6ad964e7738fc11b4184bb98eb9159f4c32601d9376fe0a98e4f2fc4dd1c",
  approvedAt: "2026-07-19T16:05:00.000Z"
};

const saveBody = {
  name: "Solution preparation",
  draft: SOLUTION_PREPARATION_V2_DRAFT,
  idempotencyKey: SAVE_KEY
};

function draftsRequest(
  method: "GET" | "POST",
  body?: unknown,
  rawBody?: string
): Request {
  return new Request("http://localhost/api/lab-composer/definitions/drafts", {
    method,
    headers:
      body === undefined && rawBody === undefined
        ? undefined
        : { "content-type": "application/json" },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
  });
}

function approvalRequest(body: unknown): Request {
  return new Request(
    `http://localhost/api/lab-composer/definitions/drafts/${DRAFT_ID}/approve`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

const approvalContext = {
  params: Promise.resolve({ draftId: DRAFT_ID })
};

describe("GET/POST /api/lab-composer/definitions/drafts", () => {
  it("lists only the authenticated teacher's drafts", async () => {
    const listDrafts = vi.fn().mockResolvedValue([draftRecord]);
    const handler = createDraftsHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: {
        listDrafts,
        saveDraft: vi.fn()
      }
    });

    const response = await handler(draftsRequest("GET"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, drafts: [draftRecord] });
    expect(listDrafts).toHaveBeenCalledOnce();
    expect(listDrafts).toHaveBeenCalledWith(TEACHER_ID);
  });

  it("rejects unauthenticated and non-teacher callers before persistence", async () => {
    const listDrafts = vi.fn();
    const saveDraft = vi.fn();
    const unauthenticated = createDraftsHandler({
      authenticate: vi.fn().mockResolvedValue(null),
      service: { listDrafts, saveDraft }
    });
    const nonTeacher = createDraftsHandler({
      authenticate: vi.fn().mockResolvedValue(student),
      service: { listDrafts, saveDraft }
    });

    expect((await unauthenticated(draftsRequest("GET"))).status).toBe(401);
    expect((await nonTeacher(draftsRequest("POST", saveBody))).status).toBe(
      403
    );
    expect(listDrafts).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and unknown request fields without saving", async () => {
    const saveDraft = vi.fn();
    const handler = createDraftsHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: { listDrafts: vi.fn(), saveDraft }
    });

    const malformed = await handler(
      draftsRequest("POST", undefined, "{not-json")
    );
    const nonStrict = await handler(
      draftsRequest("POST", { ...saveBody, validatorSaysRunnable: true })
    );

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ ok: false });
    expect(nonStrict.status).toBe(400);
    expect(await nonStrict.json()).toMatchObject({ ok: false });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("strictly rejects a body that is not a LabWorkflowDraft", async () => {
    const saveDraft = vi.fn();
    const handler = createDraftsHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: { listDrafts: vi.fn(), saveDraft }
    });

    const response = await handler(
      draftsRequest("POST", {
        name: "Broken lab",
        draft: {},
        idempotencyKey: SAVE_KEY
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("returns the same saved draft for a repeated idempotency key", async () => {
    const saveDraft = vi.fn().mockResolvedValue(draftRecord);
    const handler = createDraftsHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: { listDrafts: vi.fn(), saveDraft }
    });

    const first = await handler(draftsRequest("POST", saveBody));
    const repeated = await handler(draftsRequest("POST", saveBody));

    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, draft: draftRecord });
    expect(await repeated.json()).toEqual({ ok: true, draft: draftRecord });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft).toHaveBeenNthCalledWith(1, TEACHER_ID, saveBody);
    expect(saveDraft).toHaveBeenNthCalledWith(2, TEACHER_ID, saveBody);
  });

  it.each([
    ["list", "GET" as const],
    ["save", "POST" as const]
  ])("contains a %s persistence failure", async (_operation, method) => {
    const failure = new Error(
      "postgres://service-role:do-not-expose@db.internal/definitions"
    );
    const handler = createDraftsHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: {
        listDrafts: vi.fn().mockRejectedValue(failure),
        saveDraft: vi.fn().mockRejectedValue(failure)
      }
    });

    const response = await handler(
      method === "GET" ? draftsRequest("GET") : draftsRequest("POST", saveBody)
    );
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(responseText).not.toContain("service-role");
    expect(responseText).not.toContain("db.internal");
    expect(JSON.parse(responseText)).toMatchObject({ ok: false });
  });
});

describe("POST /api/lab-composer/definitions/drafts/[draftId]/approve", () => {
  it("rejects unauthenticated and non-teacher callers before approval", async () => {
    const approveDraft = vi.fn();
    const unauthenticated = createDraftApprovalHandler({
      authenticate: vi.fn().mockResolvedValue(null),
      service: { approveDraft }
    });
    const nonTeacher = createDraftApprovalHandler({
      authenticate: vi.fn().mockResolvedValue(student),
      service: { approveDraft }
    });

    expect(
      (
        await unauthenticated(
          approvalRequest({ idempotencyKey: APPROVAL_KEY }),
          approvalContext
        )
      ).status
    ).toBe(401);
    expect(
      (
        await nonTeacher(
          approvalRequest({ idempotencyKey: APPROVAL_KEY }),
          approvalContext
        )
      ).status
    ).toBe(403);
    expect(approveDraft).not.toHaveBeenCalled();
  });

  it("strictly rejects approval authority supplied by the client", async () => {
    const approveDraft = vi.fn();
    const handler = createDraftApprovalHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: { approveDraft }
    });

    const response = await handler(
      approvalRequest({
        idempotencyKey: APPROVAL_KEY,
        validation: { runnable: true },
        canonicalSpecHash: versionRecord.canonicalSpecHash
      }),
      approvalContext
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
    expect(approveDraft).not.toHaveBeenCalled();
  });

  it("returns the same immutable version for a repeated approval key", async () => {
    const approveDraft = vi.fn().mockResolvedValue(versionRecord);
    const handler = createDraftApprovalHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: { approveDraft }
    });
    const body = { idempotencyKey: APPROVAL_KEY };

    const first = await handler(approvalRequest(body), approvalContext);
    const repeated = await handler(approvalRequest(body), approvalContext);

    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, version: versionRecord });
    expect(await repeated.json()).toEqual({ ok: true, version: versionRecord });
    expect(approveDraft).toHaveBeenCalledTimes(2);
    expect(approveDraft).toHaveBeenNthCalledWith(1, TEACHER_ID, DRAFT_ID, body);
    expect(approveDraft).toHaveBeenNthCalledWith(2, TEACHER_ID, DRAFT_ID, body);
  });

  it("contains approval persistence failures", async () => {
    const handler = createDraftApprovalHandler({
      authenticate: vi.fn().mockResolvedValue(teacher),
      service: {
        approveDraft: vi
          .fn()
          .mockRejectedValue(new Error("service-role approval failure"))
      }
    });

    const response = await handler(
      approvalRequest({ idempotencyKey: APPROVAL_KEY }),
      approvalContext
    );
    const responseText = await response.text();

    expect(response.status).toBe(503);
    expect(responseText).not.toContain("service-role");
    expect(JSON.parse(responseText)).toMatchObject({ ok: false });
  });
});
