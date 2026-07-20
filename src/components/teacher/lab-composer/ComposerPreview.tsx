"use client";

import Link from "next/link";

import { ProductShell } from "../../ui/ProductShell";
import { useEffect, useState } from "react";

import { LabRouteShell } from "../../../app/lab/[experimentId]/LabRouteShell";
import { NativeSetupDrivenWorkspace } from "../../lab/setup-driven/NativeSetupDrivenWorkspace";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";
import { evaluateLabWorkflowEligibilityV2 } from "../../../lab-workflows/validation";
import { LocalLabPreviewRepository } from "./localRepository";

import styles from "./ComposerPreview.module.css";

interface PreviewState {
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2> | null;
  readonly error: string | null;
}

export function ComposerPreview() {
  const [state, setState] = useState<PreviewState>({
    workflow: null,
    error: null
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const hash = new URLSearchParams(window.location.search).get("hash");
        if (!hash) throw new TypeError("An exact preview hash is required.");
        const workflow = new LocalLabPreviewRepository(
          window.localStorage
        ).load(hash);
        if (!workflow)
          throw new TypeError("No saved preview matches the requested hash.");
        const eligibility = evaluateLabWorkflowEligibilityV2(
          workflow,
          "preview"
        );
        if (!eligibility.eligible) {
          throw new TypeError(
            `The saved definition is not currently preview-eligible: ${eligibility.failureCodes.join(", ")}.`
          );
        }
        setState({ workflow, error: null });
      } catch {
        setState({
          workflow: null,
          error:
            "This preview has expired. Previews are held for one visit, so head back to the Composer, run Check lab, and open Preview again."
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (state.error) {
    /*
     * Rendered inside the product shell, and as a status rather than an alert.
     * A stranded preview link used to drop the reader on a bare page with no
     * header and one button out, and styled an ordinary expired token in full
     * danger red — nothing has gone wrong here, the preview simply is not held
     * past its one visit.
     */
    return (
      <ProductShell width="narrow">
        <div className={styles.failure}>
          <p className={styles.failureEyebrow}>Lab Composer preview</p>
          <h1>Preview expired</h1>
          <div role="status">{state.error}</div>
          <Link href="/teacher/lab-composer">Return to the Composer</Link>
        </div>
      </ProductShell>
    );
  }

  if (!state.workflow) {
    return (
      <main className={styles.failure}>
        <p role="status">Loading teacher preview…</p>
      </main>
    );
  }

  const workflow = state.workflow;
  const selection = {
    workflowId: workflow.id,
    workflowHash: workflow.validation.canonicalSpecHash
  } as const;

  return (
    <div className={styles.preview} data-testid="composer-preview">
      <header className={styles.banner}>
        <div>
          <p>Teacher preview · student results are not saved</p>
          <strong>{workflow.metadata.title}</strong>
        </div>
        <Link href="/teacher/lab-composer">← Return to Composer</Link>
      </header>
      {workflow.compatibility ? (
        <LabRouteShell
          experimentId="acid_base_titration"
          title={`Preview · ${workflow.metadata.title}`}
          replaySeed={`composer-preview:${workflow.validation.canonicalSpecHash}`}
          mode="preview"
          runtimeMode="setup_driven_v2"
          setupDrivenSelection={selection}
          setupDrivenWorkflow={workflow}
        />
      ) : (
        <main className={styles.nativePreview}>
          <NativeSetupDrivenWorkspace
            workflow={workflow}
            replaySeed={`composer-preview:${workflow.validation.canonicalSpecHash}`}
          />
        </main>
      )}
    </div>
  );
}
