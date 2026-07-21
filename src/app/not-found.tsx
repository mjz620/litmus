import Link from "next/link";

import { PageHeader, ProductShell } from "../components/ui/ProductShell";

export default function NotFound() {
  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Route unavailable"
        title="This page could not be found."
        description="The address may be incorrect, or the requested lab is not available in this workspace."
      />
      <div className="ui-empty">
        <h2>Return to a verified experiment</h2>
        <p>Choose from the experiments registered in Litmus.</p>
        <Link className="ui-button" href="/experiments">
          Browse experiments
        </Link>
      </div>
    </ProductShell>
  );
}
