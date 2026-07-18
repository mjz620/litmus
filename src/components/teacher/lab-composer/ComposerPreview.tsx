"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LabRouteShell } from "../../../app/lab/[experimentId]/LabRouteShell";
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
      } catch (error) {
        setState({
          workflow: null,
          error:
            error instanceof Error
              ? error.message
              : "The saved preview could not be loaded."
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (state.error) {
    return (
      <main className={styles.failure}>
        <p>Lab Composer preview</p>
        <h1>Preview unavailable</h1>
        <div role="alert">{state.error}</div>
        <Link href="/teacher/lab-composer">Return to the Composer</Link>
      </main>
    );
  }

  if (!state.workflow) {
    return (
      <main className={styles.failure}>
        <p role="status">Loading exact validated definition…</p>
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
          <p>Isolated teacher preview · metrics are not assigned</p>
          <strong>{workflow.metadata.title}</strong>
          <code>{workflow.validation.canonicalSpecHash}</code>
        </div>
        <Link href="/teacher/lab-composer">← Return to Composer</Link>
      </header>
      <LabRouteShell
        experimentId="acid_base_titration"
        title={`Preview · ${workflow.metadata.title}`}
        replaySeed={`composer-preview:${workflow.validation.canonicalSpecHash}`}
        mode="preview"
        runtimeMode="setup_driven_v2"
        setupDrivenSelection={selection}
        setupDrivenWorkflow={workflow}
      />
    </div>
  );
}
