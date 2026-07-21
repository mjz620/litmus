import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnvironment, hasPublicSupabaseEnvironment } from "./lib/env";

/**
 * Refresh the Supabase session on every request.
 *
 * Supabase access tokens are short-lived. Server Components cannot write
 * cookies, so `createServerSupabaseClient` silently drops any refreshed token
 * it obtains — meaning that once the access token expired, every server-side
 * `auth.getUser()` saw a signed-out visitor even though the user had signed in
 * minutes earlier. That presents as auth "randomly" breaking after a while,
 * and it got sharper once the API routes started authenticating.
 *
 * This runs before the request reaches a route, where writing cookies is
 * allowed: reading the user here performs the refresh and writes the rotated
 * cookies onto the outgoing response.
 *
 * Nothing is gated here. Guest practice and the demo must keep working without
 * an account, so pages and routes remain responsible for their own access
 * checks; this only keeps a signed-in session alive.
 *
 * Next.js 16 renamed the `middleware` file convention to `proxy`.
 */
export default async function proxy(request: NextRequest) {
  if (!hasPublicSupabaseEnvironment()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const environment = getPublicEnvironment();

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          for (const { name, value } of values) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of values) {
            response.cookies.set(name, value, options);
          }
        }
      }
    }
  );

  try {
    // Reading the user is what performs the refresh and triggers setAll above.
    await supabase.auth.getUser();
  } catch {
    // An auth outage must not take the whole site down. Requests continue
    // unauthenticated, and each route decides what that means.
  }

  return response;
}

export const config = {
  /*
   * Everything except static assets. Session refresh only needs to happen on
   * requests that can read or render user state.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|glb|gltf|hdr|mp3|wav)$).*)"
  ]
};
