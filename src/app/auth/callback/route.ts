import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPublicEnvironment, hasPublicSupabaseEnvironment } from "../../../lib/env";

function resolveRoleIntent(
  value: string | null
): "student" | "teacher" | null {
  return value === "student" || value === "teacher" ? value : null;
}

function sanitizeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

function roleDestination(
  origin: string,
  role: "student" | "teacher" | null,
  nextPath: string | null
): URL {
  if (nextPath) return new URL(nextPath, origin);
  if (role === "teacher") return new URL("/teacher/classes", origin);
  if (role === "student") return new URL("/assignments", origin);
  return new URL("/auth/role", origin);
}

function redirectWithCookies(
  url: URL,
  sessionCookies: readonly {
    name: string;
    value: string;
    options?: CookieOptions;
  }[]
): NextResponse {
  const response = NextResponse.redirect(url);
  for (const { name, value, options } of sessionCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}

/**
 * Exchange the OAuth auth code and persist the session on the redirect response.
 * Next.js does not copy cookies().set(...) onto a later NextResponse.redirect(),
 * so cookies must be written onto the redirect object itself.
 *
 * Optional `role=student|teacher` comes from the sign-in page so new accounts can
 * choose their workspace before Google redirects back.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const roleIntent = resolveRoleIntent(requestUrl.searchParams.get("role"));
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const origin = requestUrl.origin;

  if (!code || !hasPublicSupabaseEnvironment()) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=callback", origin)
    );
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
              // Request-scope cookie writes can fail outside handlers; the
              // redirect response below is the source of truth for the browser.
            }
            sessionCookies.push({ name, value, options });
          }
        }
      }
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth.callback.exchange_failed", error.message);
    return redirectWithCookies(
      new URL("/auth/sign-in?error=exchange", origin),
      sessionCookies
    );
  }

  let destinationRole = roleIntent;

  if (roleIntent) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (existing?.role === "teacher" || existing?.role === "student") {
        destinationRole = existing.role;
      } else {
        const name =
          typeof data.user.user_metadata.full_name === "string"
            ? data.user.user_metadata.full_name.slice(0, 120)
            : null;
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          role: roleIntent,
          name
        });
        if (profileError) {
          console.error("auth.callback.profile_failed", profileError.message);
          destinationRole = null;
        }
      }
    }
  }

  return redirectWithCookies(
    roleDestination(origin, destinationRole, nextPath),
    sessionCookies
  );
}
