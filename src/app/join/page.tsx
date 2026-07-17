import { joinClass } from "./actions";
import { PageHeader, ProductShell } from "../../components/ui/ProductShell";
import styles from "../../components/ui/ContentSurface.module.css";

export default function JoinClassPage() {
  return (
    <ProductShell width="narrow">
      <PageHeader
        eyebrow="Student access"
        title="Join a class"
        description="Enter the code supplied by your teacher. Class codes are not case sensitive."
        backHref="/experiments"
        backLabel="Experiments"
      />
      <form className={`${styles.formCard} ui-form`} action={joinClass}>
        <label className="ui-field">
          Class code
          <input
            name="joinCode"
            minLength={6}
            maxLength={10}
            autoCapitalize="characters"
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
