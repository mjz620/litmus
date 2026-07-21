import { StudentEvidenceView } from "../../../../../components/teacher/StudentEvidenceView";
import { DEMO_CLASS_ID } from "../../../../../lib/analytics/demoFixture";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

/**
 * Student evidence inside the judge demo. Same view as the teacher route,
 * but scoped under /demo so opening a roster row keeps the playground bar
 * and Reset demo instead of ejecting the visitor into the product shell.
 */
export default async function DemoStudentDetailPage({ params }: PageProps) {
  const { studentId } = await params;
  return (
    <StudentEvidenceView
      classId={DEMO_CLASS_ID}
      studentId={studentId}
      backHref="/demo/teacher"
      backLabel="Demo readiness"
      hideSiteHeader
    />
  );
}
