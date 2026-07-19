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

export async function GET(_request?: Request) {
  return gone();
}

export async function POST(_request?: Request) {
  return gone();
}
