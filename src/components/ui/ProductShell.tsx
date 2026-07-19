import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./ProductShell.module.css";

type ContentWidth = "narrow" | "standard" | "wide" | "composer";

interface ProductShellProps {
  children: ReactNode;
  width?: ContentWidth;
}

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}

export function ProductShell({
  children,
  width = "standard"
}: ProductShellProps) {
  return (
    <>
      <ProductHeader />
      <main className={styles.page} data-width={width}>
        {children}
      </main>
    </>
  );
}

export function ProductHeader() {
  return (
    <header className={styles.siteHeader}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-label="LabBench AI home">
          <span className={styles.brandMark} aria-hidden="true">
            ⚗
          </span>
          <span className={styles.wordmark}>
            <strong>LabBench</strong>
            <small>AI chemistry practice</small>
          </span>
        </Link>
        <nav className={styles.primaryNav} aria-label="Primary navigation">
          <Link href="/experiments">Experiments</Link>
          <Link href="/demo">Demo</Link>
          <Link href="/teacher/classes">Teacher</Link>
        </nav>
      </div>
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  children
}: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      {backHref && backLabel && (
        <Link className={styles.backLink} href={backHref}>
          ← {backLabel}
        </Link>
      )}
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </header>
  );
}
