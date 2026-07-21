import type { ReactNode } from "react";

import { DemoBar } from "../../components/demo/DemoBar";

import styles from "./layout.module.css";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBar />
      <div className={styles.content}>{children}</div>
    </>
  );
}
