import Link from "next/link";

import styles from "./page.module.css";

const demoRoles = [
  {
    href: "/demo/labs",
    icon: "⚗",
    label: "Student",
    kicker: "Run a lab",
    description:
      "Four techniques on the 3D bench — titration, dilution, calorimetry, gravimetry. No account needed.",
    action: "Choose a lab"
  },
  {
    href: "/demo/teacher",
    icon: "▤",
    label: "Teacher",
    kicker: "Readiness view",
    description:
      "See how recorded lab evidence rolls up into class readiness and a student roster.",
    action: "Open teacher view"
  },
  {
    href: "/demo/composer",
    icon: "✎",
    label: "Lab Composer",
    kicker: "Authoring",
    description:
      "Build a lab from verified equipment and actions, then preview it exactly as a student would run it.",
    action: "Open Composer"
  }
] as const;

export default function DemoHubPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/">
            ← Litmus home
          </Link>
          <p className={styles.eyebrow}>Guided product tour</p>
          <h1>Litmus product demo</h1>
          <p className={styles.summary}>
            The student bench, the teacher readiness view, and Lab Composer —
            the same interfaces the product ships, running in a self-contained
            demo environment. Nothing here needs an account, and nothing you do
            leaves this area.
          </p>
          <p className={styles.accessNote}>
            <span aria-hidden="true">✓</span>
            No account or API key required
          </p>
        </header>

        <section className={styles.grid} aria-label="Demo roles">
          {demoRoles.map((role) => (
            <article className={styles.card} key={role.href}>
              {/*
                No step number. These are independent entry points, not a
                sequence — numbering them promised an order that does not
                exist and that nothing enforces.
              */}
              <span className={styles.roleIcon} aria-hidden="true">
                {role.icon}
              </span>
              <div>
                <p className={styles.kicker}>{role.kicker}</p>
                <h2>{role.label}</h2>
                <p className={styles.description}>{role.description}</p>
              </div>
              <Link className={styles.cardLink} href={role.href}>
                {role.action}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
