"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useViewer } from "../auth/ViewerContext";
import { destinationsFor } from "./navDestinations";

import styles from "./ProductShell.module.css";

/**
 * Primary navigation. A client component so it can mark the current
 * destination — without `aria-current`, a screen-reader user gets no signal
 * about where they are — and so it can read the viewer from context.
 *
 * Which destinations exist for whom is policy, and lives in navDestinations.
 */
export function PrimaryNav() {
  const pathname = usePathname();
  const viewer = useViewer();
  const destinations = destinationsFor(viewer !== null, viewer?.role ?? null);

  return (
    <nav className={styles.primaryNav} aria-label="Primary navigation">
      {destinations.map(({ href, label }) => {
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
