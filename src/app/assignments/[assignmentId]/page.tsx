import Link from "next/link";
import { redirect } from "next/navigation";

import { LabRouteShell } from "../../lab/[experimentId]/LabRouteShell";
import { NativeSetupDrivenWorkspace } from "../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { getExperimentManifest } from "../../../experiments/registry";
import { hasPublicSupabaseEnvironment } from "../../../lib/env";
import {
  resolveStudentAssignmentLaunch,
  StudentAssignmentLaunchError
} from "../../../lib/persistence/studentAssignmentLaunch";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";

interface AssignmentPageProps {
  params: Promise<{ assignmentId: string }>;
}

export default async function StudentAssignmentPage({
  params
}: AssignmentPageProps) {
  const { assignmentId } = await params;

  if (!hasPublicSupabaseEnvironment()) {
    return (
      <ProductShell>
        <PageHeader
          eyebrow="Assigned lab"
          title="Assignment unavailable"
          description="Class assignments need a configured LabBench backend. Guest practice labs remain open without an account."
          backHref="/experiments"
          backLabel="Experiments"
        />
        <p>
          <Link className="ui-button" href="/experiments">
            Open guest experiments
          </Link>
        </p>
      </ProductShell>
    );
  }

  const client = await createServerSupabaseClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) {
    redirect(
      `/auth/sign-in?next=${encodeURIComponent(`/assignments/${assignmentId}`)}`
    );
  }

  try {
    const launch = await resolveStudentAssignmentLaunch({
      assignmentId,
      membership: {
        studentId: auth.user.id,
        assertClassMember: async (classId) => {
          const { data, error } = await client
            .from("class_members")
            .select("class_id")
            .eq("class_id", classId)
            .eq("student_id", auth.user.id)
            .maybeSingle();
          return !error && data != null;
        }
      }
    });

    if (launch.kind === "setup_driven_native_v2") {
      const title = launch.assignment.title || launch.resolution.spec.metadata.title;
      return (
        <main>
          <NativeSetupDrivenWorkspace
            workflow={launch.resolution.spec}
            replaySeed={`assignment:${assignmentId}:${launch.resolution.canonicalHash}`}
            mode="assignment"
            title={title}
            sessionIdPrefix={`assignment-${assignmentId.slice(0, 8)}`}
          />
        </main>
      );
    }

    const title =
      launch.assignment.title || getExperimentManifest(launch.experimentId).title;
    const shortHash =
      launch.assignment.labDefinitionCanonicalHash?.slice(0, 18) ?? null;

    if (launch.kind === "setup_driven_v2") {
      return (
        <LabRouteShell
          experimentId={launch.experimentId}
          title={title}
          mode="assignment"
          runtimeMode="setup_driven_v2"
          setupDrivenSelection={{
            workflowId: launch.resolution.spec.id,
            workflowHash: launch.resolution.canonicalHash
          }}
          setupDrivenWorkflow={launch.resolution.spec}
          labDefinitionVersionId={launch.resolution.versionId}
          labDefinitionCanonicalHash={launch.resolution.canonicalHash}
          assignmentLabel={
            shortHash ? `${title} · pinned ${shortHash}…` : title
          }
        />
      );
    }

    return (
      <LabRouteShell
        experimentId={launch.experimentId}
        title={title}
        mode="assignment"
        runtimeMode="legacy"
        assignmentLabel={title}
      />
    );
  } catch (error) {
    const message =
      error instanceof StudentAssignmentLaunchError
        ? error.message
        : "That assignment could not be opened.";
    const forbidden =
      error instanceof StudentAssignmentLaunchError &&
      error.code === "assignment.forbidden.v1";
    return (
      <ProductShell>
        <PageHeader
          eyebrow="Assigned lab"
          title="Could not open assignment"
          description={message}
          backHref="/assignments"
          backLabel="Assignments"
        />
        <p>
          {forbidden ? (
            <Link className="ui-button" href="/join">
              Join a class
            </Link>
          ) : (
            <Link className="ui-button-secondary" href="/assignments">
              Back to my assignments
            </Link>
          )}
        </p>
      </ProductShell>
    );
  }
}
