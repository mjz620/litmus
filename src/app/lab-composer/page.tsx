import { LabComposer } from "../../components/teacher/lab-composer/LabComposer";
import { PageHeader, ProductShell } from "../../components/ui/ProductShell";

export default function LabComposerPage() {
  return (
    <ProductShell width="composer">
      <PageHeader
        eyebrow="Lab Composer · open to students and teachers"
        title="Build a student lab"
        description="Author with verified equipment and actions. Preview and local drafts work without an account. Teachers sign in to save to the cloud and assign to a class."
        backHref="/experiments"
        backLabel="Experiments"
      />
      <LabComposer />
    </ProductShell>
  );
}
