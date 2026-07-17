"use client";

import { useState } from "react";

import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const client = createBrowserSupabaseClient();
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback` }
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
      >
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && (
        <p className="ui-notice" data-tone="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
