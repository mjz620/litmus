"use client";

import { PageHeader, ProductShell } from "../components/ui/ProductShell";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Application error"
        title="This workspace could not be loaded"
        description="Your experiment data was not changed. Try loading this view again."
      />
      <div className="ui-form">
        <div className="ui-notice" data-tone="error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Litmus encountered an unexpected error.</strong>
            <p>Retry the page, or return to the experiment catalog.</p>
          </div>
        </div>
        <button className="ui-button" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </ProductShell>
  );
}
