import { actionRegistry } from "../../../lab-workflows/registries/actions";

const ENUM_VALUE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  water: "Distilled water",
  titrant: "Titrant",
  phenolphthalein: "Phenolphthalein",
  bromothymol_blue: "Bromothymol blue",
  methyl_orange: "Methyl orange",
  open: "Open",
  closed: "Closed"
});

/** Student-facing label for a registered enum parameter value. */
export function enumValueLabel(value: string): string {
  return ENUM_VALUE_LABELS[value] ?? value.replaceAll("_", " ");
}

export interface RegisteredEnumParameter {
  readonly key: string;
  readonly allowedValues: readonly string[];
}

/**
 * Registered enum parameters for an exact action ID, read from the action
 * registry so the keyboard panels can render every required choice (rinse
 * solvent, indicator, lid state) instead of silently omitting it. Registry
 * IDs resolve exactly; an unknown action fails closed to no parameters.
 */
export function registeredEnumParameters(
  actionId: string
): readonly RegisteredEnumParameter[] {
  if (!actionRegistry.has(actionId)) return [];
  return actionRegistry
    .get(actionId)
    .parameters.flatMap((parameter) =>
      parameter.valueType === "enum" && parameter.allowedValues
        ? [{ key: parameter.key, allowedValues: parameter.allowedValues }]
        : []
    );
}
