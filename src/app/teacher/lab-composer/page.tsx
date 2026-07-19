import { LabComposer } from "../../../components/teacher/lab-composer/LabComposer";
import { PageHeader, ProductShell } from "../../../components/ui/ProductShell";

export default function TeacherLabComposerPage() {
  return (
    <ProductShell width="composer">
      <PageHeader
        eyebrow="Teacher tools · Lab builder"
        title="Build a student lab"
        description="Choose what students will learn, set up their bench, decide what actions matter, and check the experience before previewing it."
        backHref="/teacher/classes"
        backLabel="Classes"
      />
      <LabComposer />
    </ProductShell>
  );
}
