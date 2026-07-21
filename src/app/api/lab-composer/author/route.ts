import { NextResponse } from "next/server";

/**
 * LC2-807: the family-oriented Author Agent v1 route is retired.
 * Production Composer AI authoring uses `/api/lab-composer/author/capability`.
 */
export const runtime = "nodejs";

function gone() {
  return NextResponse.json(
    {
      ok: false,
      error: "authoring.route_retired.v1",
      message:
        "The legacy family author route is retired. Use /api/lab-composer/author/capability."
    },
    { status: 410 }
  );
}

/** Callers still pass a Request; the retired route never reads one. */
type RetiredHandler = (request?: Request) => NextResponse;

export const GET: RetiredHandler = () => gone();

export const POST: RetiredHandler = () => gone();
