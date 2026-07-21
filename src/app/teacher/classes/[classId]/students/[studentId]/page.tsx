import { StudentEvidenceView } from "../../../../../../components/teacher/StudentEvidenceView";
import { requireTeacherForClass } from "../../../../../../components/teacher/requireTeacherForClass";

interface PageProps {
  params: Promise<{ classId: string; studentId: string }>;
}

export default async function StudentDetailPage({ params }: PageProps) {
  const { classId, studentId } = await params;
  await requireTeacherForClass(
    classId,
    `/teacher/classes/${classId}/students/${studentId}`
  );
  return (
    <StudentEvidenceView
      classId={classId}
      studentId={studentId}
      backHref={`/teacher/classes/${classId}`}
      backLabel="Class dashboard"
    />
  );
}
