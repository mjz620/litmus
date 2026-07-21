import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPublicEnvironment, hasPublicSupabaseEnvironment } from "../../../lib/env";

/**
 * Ends the session and clears the auth cookies.
 *
 * POST only: a GET sign-out can be triggered by any link or prefetch on a page
 * the user did not choose to act on. Cookies are written onto the redirect
 * response itself for the same reason as /auth/callback — Next.js does not copy
 * cookies().set(...) onto a later NextResponse.redirect().
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const home = new URL("/", origin);

  if (!hasPublicSupabaseEnvironment()) {
    return NextResponse.redirect(home, { status: 303 });
  }

  const environment = getPublicEnvironment();
  const cookieStore = await cookies();
  const sessionCookies: {
    name: string;
    value: string;
    options?: CookieOptions;
  }[] = [];

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          for (const { name, value, options } of values) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Request-scope writes can fail outside handlers; the redirect
              // response below is the source of truth for the browser.
            }
            sessionCookies.push({ name, value, options });
          }
        }
      }
    }
  );

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("auth.sign_out_failed", error.message);
  }

  /*
   * 303 so the browser follows with GET. A 307 would replay the POST against
   * the home page.
   */
  const response = NextResponse.redirect(home, { status: 303 });
  for (const { name, value, options } of sessionCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
