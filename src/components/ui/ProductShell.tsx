import Link from "next/link";
import type { ReactNode } from "react";

import { LitmusMark } from "./LitmusMark";
import { PrimaryNav } from "./PrimaryNav";

import styles from "./ProductShell.module.css";

type ContentWidth = "narrow" | "standard" | "wide" | "composer";

interface ProductShellProps {
  children: ReactNode;
  width?: ContentWidth;
  /**
   * Drops the site header. The demo playground already renders its own bar
   * through the /demo layout; stacking both reads as a broken page.
   */
  hideSiteHeader?: boolean;
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
  width = "standard",
  hideSiteHeader = false
}: ProductShellProps) {
  return (
    <>
      {!hideSiteHeader && <ProductHeader />}
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
        <Link className={styles.brand} href="/" aria-label="Litmus home">
          <LitmusMark className={styles.brandMark} />
          <span className={styles.wordmark}>
            <strong>Litmus</strong>
            <small>Chemistry rehearsal</small>
          </span>
        </Link>
        <PrimaryNav />
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
