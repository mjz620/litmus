"use client";

import { useState } from "react";

import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export type SignInRole = "student" | "teacher";

interface GoogleSignInButtonProps {
  role: SignInRole;
  label: string;
  /** Safe same-origin path to open after sign-in (e.g. /assignments). */
  nextPath?: string | null;
}

function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

export function GoogleSignInButton({
  role,
  label,
  nextPath
}: GoogleSignInButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const client = createBrowserSupabaseClient();
      const params = new URLSearchParams({ role });
      const safeNext = sanitizeNextPath(nextPath);
      if (safeNext) params.set("next", safeNext);
      const redirectTo = `${location.origin}/auth/callback?${params.toString()}`;
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo }
      });
      if (authError) throw authError;
    } catch (caught) {
      setPending(false);
      setError(
        caught instanceof Error ? caught.message : "Sign-in is unavailable."
      );
    }
  }

  return (
    <div className="ui-form">
      <button
        className="ui-button"
        type="button"
        onClick={signIn}
        disabled={pending}
        data-role={role}
      >
        {pending ? "Opening Google…" : label}
      </button>
      {error && (
        <p className="ui-notice" data-tone="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
