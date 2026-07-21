import { ComposerPreview } from "../../../../components/teacher/lab-composer/ComposerPreview";

/**
 * Composer Preview inside the judge demo. Same surface as the teacher
 * preview, scoped under /demo so trying the student experience keeps the
 * playground shell instead of ejecting the evaluator into the product.
 */
export default function DemoComposerPreviewPage() {
  return <ComposerPreview />;
}
