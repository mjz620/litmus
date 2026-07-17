import Link from "next/link";

import { GoogleSignInButton } from "../../../components/auth/GoogleSignInButton";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";
import styles from "../../../components/ui/ContentSurface.module.css";

export default function SignInPage() {
  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Account access"
        title="Sign in to LabBench AI"
        description="Use a Google account for teacher classes or saved student work. Guest practice remains available without signing in."
        backHref="/"
        backLabel="Home"
      />
      <section className={styles.formCard} aria-label="Sign-in options">
        <GoogleSignInButton />
        <div className={styles.actions}>
          <Link className="ui-button-secondary" href="/experiments">
            Continue as a guest
          </Link>
        </div>
      </section>
    </ProductShell>
  );
}
