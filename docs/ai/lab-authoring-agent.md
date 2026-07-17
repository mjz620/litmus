# Lab Authoring Agent

## Purpose

The Lab Authoring Agent turns a teacher's learning goal into a structured `LabWorkflowSpec` draft over verified LabBench registries. It chooses a supported family, components, steps, coach triggers, rubric, and adaptive retry templates. It does not create chemistry, equipment behavior, registry entries, engine state, or validator decisions.

The agent's job is pedagogical composition:

> Select and sequence known capabilities so the requested skill can be taught and assessed clearly.

## Inputs

```ts
interface LabAuthoringRequest {
  teacherRequest: string;
  gradeBand?: "9-10" | "11-12" | "mixed_high_school";
  targetMinutes?: number;
  classContext?: string;
  deviceProfileId: string;
  priorDraft?: LabWorkflowSpec;
  validatorIssues?: ValidationIssue[];
  judgeCritique?: JudgeCritique;
  revisionNumber: number;
}
```

The server supplies registry snapshots and tool access. The client must not inject tool results or claim IDs are verified.

## Output

The route returns a structured authoring result, never prose alone:

```ts
interface LabAuthoringResult {
  requestSummary: {
    objective: string;
    extractedSkillIds: string[];
    constraints: string[];
    ambiguities: string[];
  };
  proposedWorkflow: LabWorkflowSpec | null;
  claimedSupport: "candidate_runnable" | "partially_supported" | "unsupported" | "rejected_for_safety";
  missingCapabilityIds: string[];
  suggestedAlternatives: Array<{
    familyId: string;
    skillIds: string[];
    explanation: string;
  }>;
  revisionSummary?: string;
}
```

`claimedSupport` is only the agent's proposal. The application displays and persists the hard validator's `WorkflowSupportStatus` as authoritative. A generated draft starts with `supportStatus: "draft_unvalidated"` and `validation: null` regardless of the agent's confidence.

The complete workflow fields are defined in [lab-workflow-schema.md](../experiments/lab-workflow-schema.md).

## Available tools: intended contracts

These are planned server-side contracts, not implemented tools. Tool results are deterministic registry or validator data and should be version-stamped.

### `searchSkillRegistry`

```ts
searchSkillRegistry({ query: string, gradeBand?: string }): {
  matches: SkillRegistryEntry[];
  registrySnapshotId: string;
}
```

Searches canonical skill IDs, aliases, descriptions, and example prompts. It must expose availability and supported family IDs.

### `listSupportedLabFamilies`

```ts
listSupportedLabFamilies({ skillIds: string[], runnableOnly: boolean }): {
  families: LabFamilyCapability[];
  unsupportedSkillIds: string[];
}
```

Returns exact intersections of verified family support. `runnableOnly: true` is the default for a runnable proposal.

### `getComponentRegistry`

```ts
getComponentRegistry({ familyId: string, componentIds?: string[] }): {
  entries: ComponentRegistryEntry[];
  registrySnapshotId: string;
}
```

Returns component roles, actions, measurement capabilities, performance tiers, and safety restrictions. It never creates an entry from a name in the prompt.

### `getReagentRegistry`

```ts
getReagentRegistry({ familyId: string, reagentIds?: string[] }): {
  entries: ReagentRegistryEntry[];
  registrySnapshotId: string;
}
```

Returns verified profiles, container/engine compatibility, hazard metadata, and availability. Freeform concentrations or identities are not accepted.

### `getEngineCapabilities`

```ts
getEngineCapabilities({ familyId: string }): {
  engines: EngineCapability[];
  eventTypes: string[];
  eventFlags: string[];
  seedTemplateIds: string[];
}
```

Defines the chemistry/action/observation boundary the workflow may reference.

### `validateWorkflowSpec`

```ts
validateWorkflowSpec({ draft: LabWorkflowSpec }): ValidationResult
```

Runs pure hard validation. The agent must copy no result fields into a revised draft as if self-certified; the server attaches the authoritative result.

### `requestJudgeCritique`

```ts
requestJudgeCritique({
  validatedDraft: LabWorkflowSpec;
  validation: ValidationResult;
  teacherRequest: string;
}): JudgeCritique
```

Requests advisory review only for a hash-bound draft that passed minimum schema/safety eligibility. The Judge Agent cannot alter the validator result.

### `proposeSupportedAlternative`

```ts
proposeSupportedAlternative({
  teacherRequest: string;
  extractedSkillIds: string[];
  missingCapabilityIds: string[];
}): SupportedAlternative[]
```

Returns alternatives computed from verified skill/family intersections. It must not use semantic similarity alone to label an alternative supported.

## Prompt strategy

The system prompt should make the constraint hierarchy explicit:

1. Hard safety and validator policies.
2. Exact tool-returned registry capabilities.
3. Teacher's learning goal and constraints.
4. Pedagogical quality and clarity.
5. Concision and presentation.

The model should reason in a bounded planning sequence without exposing hidden chain-of-thought:

1. summarize the objective and extract candidate skills;
2. resolve canonical skills and verified family intersection;
3. choose one family for MVP;
4. query engine, component, reagent, action, event, and retry capabilities;
5. write the minimum workflow that supplies observable evidence for each target skill;
6. include positive stay-silent cases in coach policy;
7. build rubric criteria from evidence actually emitted by the engine;
8. attach required safety IDs returned by registries;
9. emit structured output only;
10. validate, then revise from explicit errors and judge critique within the revision limit.

The prompt must say that missing data is not permission to infer an ID. It should prefer an honest partial/unsupported result over a superficially complete draft.

## Using the skill registry

The agent searches the teacher's language against canonical skills, then intersects verified `supportedFamilyIds`. It must distinguish:

- a direct supported skill (`endpoint_control` → titration);
- a legacy alias (`volumetric_reading` → `meniscus_reading`);
- a planned skill whose engine is unavailable (`net_ionic_equations` before precipitation support);
- a vague request with no assessable objective (“make any lab”).

If multiple skills have no common verified family, the agent may propose separate workflows or mark the combined request partially supported. MVP output remains one engine family per workflow.

## Selecting a lab family

Select the smallest verified family that can emit evidence for all primary skills. Duration and grade level refine the workflow but cannot manufacture capability. If calorimetry is planned but unavailable, the agent must not silently translate a calorimetry request into titration; it may offer titration only as an explicitly different supported alternative.

## Selecting components and reagents

- Include all required components from the selected skills/engine.
- Add recommended components only if they serve a step and fit the device/time budget.
- Use exact component configuration and placement IDs returned by tools.
- Use exact reagent profiles and amounts within registered ranges.
- Never author apparatus state, reaction products, concentrations outside profiles, or visual chemistry outcomes.
- Treat restricted/future components as unavailable for runnable drafts.

## Writing workflow steps

Each step should:

- target at least one selected skill or a necessary prerequisite;
- use only allowed component/action combinations;
- have short, high-school-readable student instructions;
- separate observation from interpretation where pedagogically useful;
- identify completion evidence through registered event/observable IDs;
- avoid hidden dependencies on an action that is not permitted in a prior step;
- fit the requested duration under validator timing limits.

The agent may choose sequence and wording. The engine still determines whether actions succeed and what observations occur.

## Choosing coach triggers

Coach triggers must reference flags/events the chosen engine can emit and skills the workflow targets. Prefer meaningful errors, repeated failed attempts, direct questions, and step-boundary omissions. Include known positive evidence reasons that should stay silent. Do not add a trigger merely to make the workflow seem “AI-powered.”

Hints should start reflective, avoid giving away the final answer, and rely on engine/event context supplied at run time. Safety warnings use registered policy text and deterministic trigger eligibility.

## Creating rubrics

Every criterion must map to a target skill and available evidence. The agent may write descriptions, scoring guides, and teacher-friendly labels, but it cannot invent measurements or ground truth. Criteria should distinguish action evidence, structured student responses, and report explanations. Validator-derived totals and bounds prevent malformed scoring.

## Creating adaptive retry templates

The agent selects only registered templates and engine-validated seed IDs. A retry should target one or a small number of related skills, state a student goal, identify success evidence, and fit the configured time. It may not serialize arbitrary engine state or request the LLM to “set the lab near the endpoint.”

## Generate–validate–critique–revise loop

1. Produce the initial draft (`revisionNumber = 0`).
2. Run hard validation.
3. If rejected for safety or fundamentally unsupported, stop and return the authoritative status plus alternatives.
4. If eligible, request Judge Agent critique.
5. Revise using both deterministic issue codes and advisory judge issues; explain which changes address which inputs.
6. Revalidate the new hash before requesting or attaching a fresh critique.
7. Stop on `runnable` + judge `approve`, or when the maximum revision count is reached.

The maximum is **two revisions after the initial draft** (three authored candidates total). This controls latency, cost, and infinite loops. At the limit, return the latest hard status and unresolved critique; do not self-approve.

Validator errors take precedence. The agent should fix exact issue paths and supported IDs, not merely rewrite prose. If errors conflict with judge advice, preserve validation and state why the advice cannot be applied.

## Unsupported and refusal behavior

Return an unsupported/non-runnable result when:

- no canonical objective can be extracted;
- no verified family supports the requested skill set;
- a required component, action, reagent, event flag, seed, or engine is unavailable;
- satisfying the request would require invented chemistry or physics;
- the request asks the model to bypass validation or conceal unsupported status.

Return `rejected_for_safety` when the deterministic validator identifies a prohibited combination/policy. The author may offer a validator-backed safer alternative but must not debate away the restriction.

For aspirin synthesis, explicitly list the missing organic synthesis, heating/reflux, filtration, recrystallization, yield/purity, and safety capabilities. A non-runnable teaching outline is permissible if labeled clearly; Preview and Assign remain disabled.

## Examples

### Supported target after registry migration

Teacher: “Create a 7-minute acid-base titration pre-lab focused on endpoint control and meniscus reading.”

Agent behavior: resolve two skills to the titration family; choose the verified burette/flask/indicator configuration and near-endpoint seed; create reading and controlled-delivery steps; use existing meniscus/high-flow/overshoot evidence; validate; request critique; revise only if needed.

### Planned but not yet runnable

Teacher: “Create a lab that helps students practice net ionic equations.”

Agent behavior today: map to `net_ionic_equations` and the planned precipitation family, report missing verified engine/equation-event support, return a partially supported outline if useful, and do not expose preview/assignment.

### Unsafe or unsupported

Teacher: “Create an open-flame aspirin synthesis lab.”

Agent behavior: never assemble the restricted heat-source component; return the validator's safety/unsupported issues and a clearly different, registry-backed alternative if pedagogically relevant.
