import Link from "next/link";

import { GoogleSignInButton } from "../../../components/auth/GoogleSignInButton";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";
import styles from "../../../components/ui/ContentSurface.module.css";

interface SignInPageProps {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
}

function authErrorMessage(error: string | undefined): string | null {
  switch (error) {
    case "callback":
      return "Google sign-in did not return a valid login code. Try again from this same address (use either localhost or 127.0.0.1 consistently).";
    case "exchange":
      return "Google signed you in, but Litmus could not create a session cookie. Try once more; if it keeps failing, check that this site's /auth/callback address is allowed in Supabase Auth redirect URLs.";
    default:
      return error ? "Sign-in failed. Please try again." : null;
  }
}

function sanitizeNextPath(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const message = authErrorMessage(rawError);
  const nextPath = sanitizeNextPath(rawNext);

  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Account access"
        title="Sign in to Litmus"
        description="Choose student or teacher, then continue with Google. Guest practice stays available without an account."
        backHref="/"
        backLabel="Home"
      />
      <section className={styles.choiceSurface} aria-label="Sign-in options">
        {message && (
          <p className="ui-notice" data-tone="error" role="alert">
            {message}
          </p>
        )}
        <div className={styles.choiceGrid}>
          <div className={styles.choice}>
            <div>
              <strong>Student</strong>
              <p className={styles.helper}>
                Practice labs, join a class, and keep saved work.
              </p>
            </div>
            <GoogleSignInButton
              role="student"
              label="Sign in as student"
              nextPath={nextPath}
            />
          </div>
          <div className={styles.choice}>
            <div>
              <strong>Teacher</strong>
              <p className={styles.helper}>
                Manage classes, cloud-save Composer labs, and assign work.
              </p>
            </div>
            <GoogleSignInButton
              role="teacher"
              label="Sign in as teacher"
              nextPath={nextPath}
            />
          </div>
        </div>
        <div className={styles.actions}>
          <Link className="ui-button-secondary" href="/experiments">
            Continue as a guest
          </Link>
        </div>
      </section>
    </ProductShell>
  );
}
