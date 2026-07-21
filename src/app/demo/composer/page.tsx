import { LabComposer } from "../../../components/teacher/lab-composer/LabComposer";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";

/**
 * Lab Composer inside the judge demo. The same authoring surface as
 * /lab-composer, kept in the demo area so an evaluator never leaves the
 * controlled environment mid-journey. Drafts stay local to the browser;
 * cloud save and Assign remain teacher-only, as they are in production.
 */
export default function DemoComposerPage() {
  return (
    <ProductShell width="composer">
      <PageHeader
        eyebrow="Lab Composer"
        title="Build a student lab"
        description="Author with verified equipment and actions, then preview the result. Drafts stay in this browser for the demo."
        backHref="/demo"
        backLabel="Demo"
      />
      <LabComposer />
    </ProductShell>
  );
}
