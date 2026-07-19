import { joinClass } from "./actions";
import { PageHeader, ProductShell } from "../../components/ui/ProductShell";
import styles from "../../components/ui/ContentSurface.module.css";

interface JoinClassPageProps {
  searchParams: Promise<{ code?: string | string[] }>;
}

export default async function JoinClassPage({ searchParams }: JoinClassPageProps) {
  const params = await searchParams;
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const defaultCode =
    typeof rawCode === "string" ? rawCode.trim().toUpperCase().slice(0, 10) : "";

  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Student access"
        title="Join a class"
        description="Enter the code supplied by your teacher. Class codes are not case sensitive."
        backHref="/assignments"
        backLabel="Assignments"
      />
      <form className={`${styles.formCard} ui-form`} action={joinClass}>
        <label className="ui-field">
          Class code
          <input
            name="joinCode"
            minLength={6}
            maxLength={10}
            autoCapitalize="characters"
            defaultValue={defaultCode}
            required
          />
        </label>
        <button className="ui-button" type="submit">
          Join class
        </button>
      </form>
    </ProductShell>
  );
}
