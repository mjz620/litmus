"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./ProductShell.module.css";

const DESTINATIONS: readonly { readonly href: string; readonly label: string }[] =
  Object.freeze([
    { href: "/experiments", label: "Experiments" },
    { href: "/assignments", label: "Assignments" },
    { href: "/join", label: "Join" },
    { href: "/lab-composer", label: "Composer" },
    { href: "/demo", label: "Demo" },
    { href: "/teacher/classes", label: "Teacher" },
    { href: "/auth/sign-in", label: "Sign in" }
  ]);

/**
 * Primary navigation. A client component only so it can mark the current
 * destination: without `aria-current`, a screen-reader user gets no signal
 * about where they are, and the active link looked identical to every other.
 */
export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.primaryNav} aria-label="Primary navigation">
      {DESTINATIONS.map(({ href, label }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
