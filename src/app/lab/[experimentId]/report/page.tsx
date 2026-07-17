import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportForm } from "../../../../components/lab/report/ReportForm";
import { resolveExperimentId } from "../../../../components/ui/experimentRoutes";
import { ProductShell } from "../../../../components/ui/ProductShell";

interface PageProps {
  params: Promise<{ experimentId: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { experimentId } = await params;
  if (resolveExperimentId(experimentId) !== "acid_base_titration") notFound();
  return (
    <ProductShell>
      <Link className="ui-button-quiet" href={`/lab/${experimentId}`}>
        ← Return to lab
      </Link>
      <ReportForm />
    </ProductShell>
  );
}
