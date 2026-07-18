import { LabComposer } from "../../../components/teacher/lab-composer/LabComposer";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";

export default function TeacherLabComposerPage() {
  return (
    <ProductShell width="wide">
      <PageHeader
        eyebrow="Teacher workspace · Lab Composer"
        title="Compose a verified lab"
        description="Arrange registered equipment and materials, then express flexible workflow constraints and evidence mappings. Every edit stays unvalidated until deterministic review."
        backHref="/teacher/classes"
        backLabel="Classes"
      />
      <LabComposer />
    </ProductShell>
  );
}
