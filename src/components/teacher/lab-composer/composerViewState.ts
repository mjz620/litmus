export const COMPOSER_VIEW_STATE_SCHEMA_VERSION = "1.0.0" as const;
export const COMPOSER_VIEW_STATE_KEY_PREFIX = "labbench.composer.view.v1:";

export type ComposerWorkflowView = "graph" | "outline";

export interface ComposerNodePosition {
  readonly x: number;
  readonly y: number;
}

export interface ComposerViewState {
  readonly schemaVersion: typeof COMPOSER_VIEW_STATE_SCHEMA_VERSION;
  readonly workflowId: string;
  readonly workflowView: ComposerWorkflowView;
  readonly nodePositions: Readonly<Record<string, ComposerNodePosition>>;
  readonly selectedRuleId?: string;
  readonly selectedObjectiveId?: string;
}

interface ViewStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function key(workflowId: string): string {
  return `${COMPOSER_VIEW_STATE_KEY_PREFIX}${encodeURIComponent(workflowId)}`;
}

function validPosition(value: unknown): value is ComposerNodePosition {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).length === 2 &&
    "x" in value &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    Math.abs(value.x) <= 100_000 &&
    "y" in value &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    Math.abs(value.y) <= 100_000
  );
}

function parseViewState(
  input: unknown,
  workflowId: string,
  currentRuleIds: ReadonlySet<string>
): Readonly<ComposerViewState> | null {
  if (
    typeof input !== "object" ||
    input === null ||
    !("schemaVersion" in input) ||
    input.schemaVersion !== COMPOSER_VIEW_STATE_SCHEMA_VERSION ||
    !("workflowId" in input) ||
    input.workflowId !== workflowId ||
    !("workflowView" in input) ||
    (input.workflowView !== "graph" && input.workflowView !== "outline") ||
    !("nodePositions" in input) ||
    typeof input.nodePositions !== "object" ||
    input.nodePositions === null
  ) {
    return null;
  }
  const nodePositions = Object.fromEntries(
    Object.entries(input.nodePositions)
      .filter(
        (entry): entry is [string, ComposerNodePosition] =>
          currentRuleIds.has(entry[0]) && validPosition(entry[1])
      )
      .sort(([left], [right]) => left.localeCompare(right))
  );
  const selectedRuleId =
    "selectedRuleId" in input &&
    typeof input.selectedRuleId === "string" &&
    currentRuleIds.has(input.selectedRuleId)
      ? input.selectedRuleId
      : undefined;
  const selectedObjectiveId =
    "selectedObjectiveId" in input &&
    typeof input.selectedObjectiveId === "string"
      ? input.selectedObjectiveId
      : undefined;
  return Object.freeze({
    schemaVersion: COMPOSER_VIEW_STATE_SCHEMA_VERSION,
    workflowId,
    workflowView: input.workflowView,
    nodePositions: Object.freeze(nodePositions),
    ...(selectedRuleId ? { selectedRuleId } : {}),
    ...(selectedObjectiveId ? { selectedObjectiveId } : {})
  });
}

export class LocalComposerViewStateRepository {
  constructor(private readonly storage: ViewStorage) {}

  load(
    workflowId: string,
    currentRuleIds: readonly string[]
  ): Readonly<ComposerViewState> | null {
    const serialized = this.storage.getItem(key(workflowId));
    if (serialized === null) return null;
    try {
      return parseViewState(
        JSON.parse(serialized) as unknown,
        workflowId,
        new Set(currentRuleIds)
      );
    } catch {
      return null;
    }
  }

  save(
    workflowId: string,
    state: Omit<ComposerViewState, "schemaVersion" | "workflowId">,
    currentRuleIds: readonly string[]
  ): void {
    const parsed = parseViewState(
      {
        schemaVersion: COMPOSER_VIEW_STATE_SCHEMA_VERSION,
        workflowId,
        ...state
      },
      workflowId,
      new Set(currentRuleIds)
    );
    if (!parsed) throw new TypeError("Composer view state is invalid.");
    this.storage.setItem(key(workflowId), JSON.stringify(parsed));
  }
}

export function pruneComposerNodePositions(
  positions: Readonly<Record<string, ComposerNodePosition>>,
  currentRuleIds: readonly string[]
): Readonly<Record<string, ComposerNodePosition>> {
  const allowed = new Set(currentRuleIds);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(positions)
        .filter(([id, position]) => allowed.has(id) && validPosition(position))
        .sort(([left], [right]) => left.localeCompare(right))
    )
  );
}
