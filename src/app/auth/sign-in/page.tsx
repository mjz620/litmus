import Link from "next/link";
import { redirect } from "next/navigation";

import { getViewer, roleHomePath } from "../../../lib/auth/viewer";
import { GoogleSignInButton } from "../../../components/auth/GoogleSignInButton";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";
import styles from "../../../components/ui/ContentSurface.module.css";

interface SignInPageProps {
  searchParams: Promise<{
    error?: string | string[];
    reason?: string | string[];
    next?: string | string[];
  }>;
}

function authErrorMessage(
  error: string | undefined,
  reason: string | undefined
): string | null {
  switch (error) {
    case "provider":
      /*
       * The identity provider's own words. Reported verbatim because the
       * generic wording that used to stand in here sent people looking at the
       * wrong thing — "Unable to exchange external code" means the Google
       * client secret stored in Supabase is stale, which no amount of retrying
       * fixes.
       */
      return reason
        ? `Google sign-in failed: ${reason}`
        : "Google sign-in failed before it could return a login code.";
    case "unconfigured":
      return "Sign-in is not configured on this deployment. Guest practice remains available.";
    case "callback":
      return "Google sign-in did not return a login code. Please try again.";
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
  const rawReason = Array.isArray(params.reason)
    ? params.reason[0]
    : params.reason;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const message = authErrorMessage(rawError, rawReason?.slice(0, 200));
  const nextPath = sanitizeNextPath(rawNext);

  /*
   * A signed-in account never sees the role picker again. This page offers both
   * roles side by side, so leaving it reachable while signed in read as an
   * invitation to hold the other one — the callback would have silently kept
   * the original role and dropped the user somewhere they did not ask for.
   */
  const viewer = await getViewer();
  if (viewer) redirect(nextPath ?? roleHomePath(viewer.role));

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
