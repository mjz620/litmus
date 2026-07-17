import { NextResponse } from "next/server";

import { getDemoResetter, type DemoResetter } from "../../../../lib/demo/reset";

export function createDemoResetHandler(resetter: DemoResetter) {
  return async function resetHandler() {
    try {
      return NextResponse.json({ ok: true, ...(await resetter.reset()) });
    } catch {
      return NextResponse.json(
        { error: "Demo reset unavailable." },
        { status: 503 }
      );
    }
  };
}

export async function POST() {
  return createDemoResetHandler(getDemoResetter())();
}
