import type { ReactNode } from "react";

import { DemoBar } from "../../components/demo/DemoBar";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBar />
      {children}
    </>
  );
}
