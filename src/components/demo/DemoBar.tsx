"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { DEMO_TRACE_STORAGE_KEY } from "../../lib/demo/demoTrace";

import styles from "./DemoBar.module.css";

export function DemoBar() {
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);
  const roles = [
    { href: "/demo/student", label: "Student", icon: "⚗" },
    { href: "/demo/teacher", label: "Teacher", icon: "✎" },
    { href: "/demo/technical", label: "Technical", icon: "⌘" }
  ] as const;
  async function reset() {
    setResetting(true);
    try {
      await fetch("/api/demo/reset", { method: "POST" });
      localStorage.removeItem(DEMO_TRACE_STORAGE_KEY);
      location.assign("/demo");
    } finally {
      setResetting(false);
    }
  }

  return (
    <nav className={styles.bar} aria-label="Demo roles">
      <Link className={styles.brand} href="/demo">
        <span aria-hidden="true">✦</span>
        <span>
          <strong>LabBench</strong>
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
