import Link from "next/link";

import styles from "./page.module.css";

const demoRoles = [
  {
    href: "/demo/student",
    icon: "⚗",
    label: "Student",
    kicker: "Interactive lab",
    description:
      "Run the default setup-driven titration without an account and produce real semantic evidence.",
    action: "Open student demo"
  },
  {
    href: "/demo/teacher",
    icon: "▤",
    label: "Teacher",
    kicker: "Readiness view",
    description:
      "View seeded class metrics plus the current live demo session.",
    action: "Open teacher demo"
  },
  {
    href: "/lab-composer",
    icon: "✎",
    label: "Lab Composer",
    kicker: "Authoring",
    description:
      "Build and preview labs as a student or teacher. Cloud save and Assign require teacher sign-in.",
    action: "Open Composer"
  },
  {
    href: "/demo/technical",
    icon: "⌘",
    label: "Technical",
    kicker: "Evidence trace",
    description:
      "Inspect the engine, events, StudentModel, coach, checkpoint, and eval trace.",
    action: "Open technical demo"
  }
] as const;

export default function DemoHubPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/">
            ← LabBench AI home
          </Link>
          <p className={styles.eyebrow}>Guided product tour</p>
          <h1>LabBench AI judge demo</h1>
          <p className={styles.summary}>
            Judges can reach the student bench, teacher readiness view, and Lab
            Composer from this hub. Guest practice needs no account; teachers
            sign in only to persist drafts and create assignments.
          </p>
          <p className={styles.accessNote}>
            <span aria-hidden="true">✓</span>
            No account or API key required for demo paths
          </p>
        </header>

        <section className={styles.grid} aria-label="Demo roles">
          {demoRoles.map((role, index) => (
            <article
              className={styles.card}
              data-featured={index === 0 ? "true" : undefined}
              key={role.href}
            >
              <div className={styles.cardTopline}>
                <span className={styles.roleIcon} aria-hidden="true">
                  {role.icon}
                </span>
                <span className={styles.step}>0{index + 1}</span>
              </div>
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
