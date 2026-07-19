import { redirect } from "next/navigation";

/** Canonical Composer lives at /lab-composer for both students and teachers. */
export default function TeacherLabComposerRedirectPage() {
  redirect("/lab-composer");
}
