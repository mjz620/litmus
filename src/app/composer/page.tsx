import { redirect } from "next/navigation";

/**
 * The nav and docs say "Composer", so /composer is the address people type;
 * the authoring surface lives at /lab-composer. Redirect instead of 404ing.
 */
export default function ComposerRedirectPage() {
  redirect("/lab-composer");
}
