"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LitmusMark } from "../ui/LitmusMark";

import styles from "./DemoBar.module.css";

export function DemoBar() {
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);
  /*
   * Every destination stays under /demo so the evaluator never leaves the
   * controlled area — that prefix is also what routes the coach, evaluation,
   * and checkpoint calls to the isolated demo endpoints.
   */
  const roles = [
    { href: "/demo/labs", label: "Labs", icon: "⚗" },
    { href: "/demo/teacher", label: "Teacher", icon: "✎" },
    { href: "/demo/composer", label: "Composer", icon: "▤" }
  ] as const;
  async function reset() {
    setResetting(true);
    try {
      await fetch("/api/demo/reset", { method: "POST" });
      location.assign("/demo");
    } finally {
      setResetting(false);
    }
  }

  return (
    <nav className={styles.bar} aria-label="Demo roles">
      <Link className={styles.brand} href="/demo">
        <LitmusMark className={styles.brandMark} />
        <span>
          <strong>Litmus</strong>
          <small>playground</small>
        </span>
      </Link>
      <div className={styles.links}>
        {roles.map((role) => {
          const active = pathname.startsWith(role.href);
          return (
            <Link
              key={role.href}
              href={role.href}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{role.icon}</span>
              {role.label}
            </Link>
          );
        })}
      </div>
      <button type="button" onClick={reset} disabled={resetting}>
        <span aria-hidden="true">↻</span>
        {resetting ? "Resetting…" : "Reset demo"}
      </button>
    </nav>
  );
}
