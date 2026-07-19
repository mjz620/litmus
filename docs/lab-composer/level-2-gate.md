# Lab Composer Level 2 Gate Evidence

**Status:** Passed on 2026-07-18  
**Scope:** `LC2-503`, non-LLM capability-driven authoring and execution

The Level 2 gate is satisfied by two serialized workflows—migrated endpoint-control titration and native sodium-chloride solution preparation—using the same strict `LabWorkflowSpec`, validator, generic coordinator, constraint evaluator, semantic-event envelope, diagnosis projection, replay path, human command service, Composer save/load flow, and Preview route. `familyId` remains optional catalog metadata and is not used to select runtime behavior.

## Ten-criterion gate

| # | Criterion | Executable evidence |
| --- | --- | --- |
| 1 | Equipment is assembled from reusable definitions. | Exact component, configuration, scene-placement, visual-adapter, and mechanical-adapter resolution is covered by `tests/lab-workflows/registries/components/componentRegistry.test.ts`, `tests/lab-workflows/registries/scenePlacementRegistry.test.ts`, and `tests/components/setupDrivenNativeWorkspace.test.ts`. |
| 2 | Material bindings and setup configuration are validated. | `tests/lab-workflows/validationV2.test.ts`, `tests/lab-workflows/validation/boundedConcentrationValidation.test.ts`, and `tests/lab-workflows/material-initialization/` cover exact profiles, containers, initialization schemas, units, bounds, and stale artifacts. |
| 3 | Actions are capability-checked. | `tests/lab-workflows/registries/actions/actionContracts.test.ts`, `tests/lab-workflows/runtime/generic/genericRuntime.test.ts`, and `tests/lab-workflows/mechanics/dilutionMechanics.test.ts` cover source/target capabilities, parameters, permissions, preconditions, and fail-before-mutation behavior. |
| 4 | The same generic runtime executes more than one lab setup. | `tests/components/setupDrivenNativeWorkspace.test.ts` constructs both native solution-preparation and compatibility titration sessions through `src/stores/setupDrivenLabSession.ts`; `tests/lab-workflows/definitions/titrationDefinition.test.ts` and `solutionPreparationDefinition.test.ts` exercise the shared coordinator. |
| 5 | At least two valid procedural orders are accepted. | `tests/lab-workflows/definitions/solutionPreparationDefinition.test.ts` executes canonical and alternate-valid normalized traces to equivalent valid completion. |
| 6 | Success, failure, recoverability, and tolerance rules work. | The same five-trace suite covers canonical success, recoverable correction, terminal failure, and just-inside/equal/just-outside tolerance behavior against runtime-produced observables. |
| 7 | Semantic events and diagnoses are inspectable. | Runtime and student-preview tests assert stable event envelopes, rule evidence IDs, diagnoses, observables, and plain-language evidence projection. |
| 8 | A setup can be saved, loaded, previewed, and replayed. | `tests/e2e/lab-composer.spec.ts` authors from the solution-preparation template, saves, reloads, validates, previews, completes by keyboard, and verifies offline-after-load behavior; definition tests prove serialized trace replay equality. |
| 9 | Existing titration behavior remains compatible. | `tests/lab-workflows/definitions/titrationDefinition.test.ts` compares legacy and generic compatibility transitions, state, semantic events, diagnoses, and completion; the existing titration suites remain in the full unit run. |
| 10 | No runtime branch is selected solely from a family ID. | `tests/lab-workflows/runtime/generic/importBoundaries.test.ts` and the static boundary in `solutionPreparationDefinition.test.ts` reject family dispatch; native/legacy selection is based only on the validated explicit compatibility descriptor. |

## Verification record

- `npm test -- --run`: 102 files, 584 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/lab-composer.spec.ts --project=chromium`: 18 tests passed.
- `npm run build`: passed; 21 pages generated.
- Common-viewport Composer coverage includes 768 px, 1024×768, desktop, and 1600 px layouts; the native Preview remains contained and keyboard-operable.

## Authority and remaining boundaries

Deterministic validation is the only Preview authority. Native Preview requires a current matching hash and exact registered runtime support; edits invalidate prior validation and Judge artifacts. Assignment remains unavailable until immutable version persistence and explicit approval land in Phase 8. Passing Level 2 authorizes Phase 6 agent migration; it does not itself claim a completed Level 3 agent workflow.
