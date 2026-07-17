import { NextResponse } from "next/server";

import { hasPublicSupabaseEnvironment } from "../../../lib/env";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code || !hasPublicSupabaseEnvironment()) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=callback", url));
  }

  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(
    new URL(error ? "/auth/sign-in?error=exchange" : "/auth/role", url)
  );
}
