# Titration Legacy Retirement Checklist

The Phase 5 flip (2026-07-20) made the capability-native runtime the
`/lab/titration` default. The legacy engine and the setup-driven strangler
survive only as explicit rollback paths (`?runtime=legacy`,
`?runtime=setup-v2`). This is the precise deletion checklist for the
post-rollback release — execute it only after the native default has shipped a
release with no rollback, and delete top-down (routes → stores → runtime →
engine) so nothing dangles.

Every item lists its verification step. "Re-pin" means: run the named test,
take the new expected hash/fixture from the failure, and commit it as a
deliberate change — never silently regenerate.

## 1. Route and query-param surface

| Delete | Where | Verify |
|---|---|---|
| `?runtime=legacy` and `?runtime=setup-v2` handling (`LEGACY_TITRATION_RUNTIME_FLAG`, `SETUP_DRIVEN_TITRATION_RUNTIME_FLAG`, the `setup_driven_v2`/`legacy` branches of `resolveLabSessionRuntimeMode`) | `src/stores/setupDrivenLabSession.ts` | update the default-mode tests in `tests/stores/nativeTitrationSession.test.ts`, `tests/stores/labStore.test.ts`, `tests/integration/phase8ProductionFlow.test.ts` to expect `native_v2` only |
| `?retry=` → legacy forcing, `retrySkillId` wiring | `src/app/lab/[experimentId]/page.tsx`, `src/components/lab/useLabSession.ts`, `src/components/lab/retry/RetryBanner.tsx` | replace the retry flow with a native drill launch (`?runtime=endpoint-drill`) before deleting; `tests/e2e/report-retry-voice.spec.ts` re-authored against it |
| `SetupDrivenLabRouteShell` branch + strangler selections (`FULL_TITRATION_SETUP_SELECTION`, `STRICT_TITRATION_SETUP_SELECTION`) | `src/app/lab/[experimentId]/LabRouteShell.tsx`, `page.tsx` | `npx vitest run tests/`; delete the `?runtime=setup-v2` e2e specs listed in §6 |
| Dev-route strangler pin (`setup_driven_v2` default for titration) | `src/app/dev/lab/[experimentId]/page.tsx`, `DevLabShell.tsx` (TitrationWorkspace rendering) | re-point DevLabShell at the native workspace or a generic diagnostics view; `tests/e2e/student-routes.spec.ts`, `student-surface.spec.ts` dev sections re-authored |
| Demo strangler pin | `src/app/demo/student/page.tsx` | flip the demo to the native drill; update `tests/e2e/demo-flow.spec.ts`, `demo-endpoint-exit.spec.ts`, the demo section of `setup-driven-session.spec.ts`, and the `/demo/technical` provenance expectations (workflow ID becomes the native one) |

## 2. Stores and session layer

| Delete | Where | Verify |
|---|---|---|
| `createSetupDrivenTitrationSession` (compatibility session) | `src/stores/setupDrivenLabSession.ts` | `tests/stores/labStore.test.ts` setup-driven cases deleted alongside |
| `normalizeSetupDrivenTitrationAction` + `titrationActionContract` (legacy action → v2 mapping) | same | remaining consumer is the legacy-shaped `dispatch`; goes with the labStore branches below. `submit_report` needs a reviewed native report action contract first (see §5) |
| `projectNativeTitrationState` (TitrationState projection over native truth) + `nativeEquipmentField`/`nativeNumberField` helpers | same | last consumers: `createSetupDrivenNativeTitrationSession` (labStore view) and `isTitrationState` guards. Replace the labStore state view with the generic projection, then delete. `tests/stores/nativeTitrationSession.test.ts` re-authored against generic state |
| `createSetupDrivenNativeTitrationSession` (bridge wrapper) — keep `createSetupDrivenNativeSession` | same | after labStore/report move to generic state |
| labStore titration branches: `initializeRegisteredExperiment` legacy/setup-driven arms, `dispatchSetupDrivenTitration`, `stepRegisteredExperiment`, `isTitrationState`, `isTitrationAction`, `LabExperimentConfig/State/Action` aliases | `src/stores/labStore.ts` (~560–700) | `npx vitest run tests/stores/`; `isTitrationState` consumers to migrate first: `ReportForm`, `LabSessionBar`, `LabNotebook`, `DemoTraceRecorder`, `LabRouteShell`, `DevLabShell` |
| `useLabSession` titration config generation (`generateTitrationSessionConfig`, `createTitrationRetryScenario`) and the `config` field of `LoadExperimentRequest` | `src/components/lab/useLabSession.ts`, `labStore.ts` | native sessions never read `config`; typecheck + `tests/stores/` |

## 3. Generic-runtime compatibility layer

| Delete | Where | Verify |
|---|---|---|
| Legacy titration runtime adapter | `src/lab-workflows/runtime/legacy/titration.ts`, `errors.ts`, `index.ts` exports (`createLegacyTitrationRuntimePorts`, `parseLegacyTitrationCompatibilityState`) | `tests/lab-workflows/` runtime suites; `titrationRuntime.ts` compatibility branches |
| Titration adapter metadata | `src/lab-workflows/adapters/titration/` (`index.ts`, `metadata.ts`) | adapter registry tests; snapshot bump for the registry that lists it |
| Engine registry entry `engine.titration.v1` + `engine_config.titration.strong_acid_strong_base_25ml.v1` | `src/lab-workflows/registries/engines/entries.ts` | snapshot bump; every pinned definition referencing them re-validated (the compatibility definitions below are deleted in the same change, so nothing should remain) |
| Strangler workflow definitions (compatibility-owned): `endpoint-control.v2.json`, `full-titration.v2.json`, their `index.ts` validators/hash pins and `fullTitrationAuthoring.ts`/`fullTitrationTracePlan.ts` **only where compatibility-specific** (the native authoring reuses `FULL_TITRATION_AUTHORING_COMMANDS` — relocate, never copy) | `src/lab-workflows/definitions/titration/` | `tests/lab-workflows/definitions/titrationDefinition.test.ts`, `fullTitrationDefinition.test.ts` deleted; `nativeFullTitrationDefinition.test.ts` keeps covering the shared authoring commands |
| Legacy replay path `legacyTitration.ts` + its exports in `replay/index.ts` | `src/lab-workflows/replay/` | replay suites in `tests/lab-workflows/` |
| Legacy seed workflow `endpointControlPrelab.ts` | `src/lab-workflows/seeds/` | seed replay tests; `SETUP_DRIVEN_TITRATION_WORKFLOW_ID` references gone |

## 4. Legacy engine and experiment core

| Delete | Where | Verify |
|---|---|---|
| Legacy titration engine (`titration.ts`), `replay.ts`, `retry.ts`, `sessionConfig.ts`, `manifest.ts` | `src/experiments/titration/` | `tests/experiments/` titration suites deleted; catalog card must first source duration/metadata from the native workflow (`native-full-titration.v2.json`) — fixes KI-002 with a deliberate hash re-pin |
| `display.ts` (`formatBuretteVolume`, `formatPH`) and `procedureStage.ts` — **relocate, never copy**, to a shared UI home (they serve `LabNotebook`/`nativeTitrationFacts`) | `src/experiments/titration/display.ts`, `src/components/lab/titration/procedureStage.ts` | typecheck; notebook/facts tests |
| `IndicatorId`/`INDICATOR_SPECIFICATIONS` UI imports move to `src/lab-workflows/chemistry-models/acid-base` (already the canonical home) | `IndicatorSelectionDialog`, workspace files | typecheck |
| Registry entry for `acid_base_titration` (`loadExperimentDefinition`, `getExperimentManifest`) or its rewiring to workflow metadata | `src/experiments/registry.ts` | checkpoint contract: decide the `experimentId`/`experimentVersion` recorded for native sessions **before** deleting (persisted rows reference them) |
| **Acid-base model legacy raw-float parity fields** (`rawDeliveredML` accumulation and friends, marked "Legacy-parity" in `model.ts`) — replace with scaled-integer accumulation | `src/lab-workflows/chemistry-models/acid-base/model.ts` | deliberate re-pin: native definition hashes change; `nativeTitration.test.ts`, `nativeFullTitrationDefinition.test.ts` expected hashes updated in the same commit with a changelog note |

## 5. Report flow

The report route currently reproduces pre-flip behavior: `submit_report`
falls through labStore to the legacy `titration.step()` over the projected
`TitrationState`, and `/api/evaluate` takes the legacy-shaped request. Before
deleting the engine:

- author a native report consumer (generic state/event envelopes +
  `reportRubric` from definition metadata, or the existing authored evaluator
  v2 contract in `evaluatorSchemas.ts`), and
- move `ReportForm`/`ReportFeedback` off `isTitrationState`.

Verify: report e2e (`report-retry-voice.spec.ts` successor) plus
`tests/coach`/`tests/ai` evaluator suites.

Also close the pre-existing gap: the native **assignment** route
(`/assignments/[id]` → `NativeSetupDrivenWorkspace` without a session port)
persists nothing. Wire it through the same lab-store port (or a dedicated
persistence host) before teacher dashboards depend on assignment evidence.

## 6. UI (legacy rollback components)

| Delete | Where | Verify |
|---|---|---|
| `TitrationWorkspace`, `TitrationScene`, `TitrationControls`, `TitrationProcedureGuide`, `titrationProcedureSteps.ts`, `useTitrationIntents.ts` + their `.module.css` | `src/components/lab/titration/` | typecheck; delete `tests/e2e` specs pinned to `?runtime=setup-v2` (`titration-controls`, `titration-equipment`, `titration-camera`, `titration-physical-equipment`, `stopcock-gate`, `procedural-sound`, `accessibility-refill` lab section, `equipment-hover` titration case, `student-surface`, `typography-system` lab section) after authoring native equivalents |
| Re-export shims: `titration/equipment.ts`, `titration/setupDrivenScene.ts`, `titration/IndicatorSelectionDialog.tsx`, `titration/useDispenseGesture.ts` | same | update remaining importers (`three/LabScene.tsx`, `three/Interactable.tsx`, `three/Burette.tsx`, `stores/labUiStore.ts`, tests) to the `setup-driven/` homes, then delete |
| `LabSessionBar`/`LabNotebook`/`DemoTraceRecorder` titration-state branches | `src/components/lab/` | native facts path (`nativeTitrationFacts.ts`) already covers the notebook; session bar stage falls back to workflow status |

## 7. Parity oracle and fixtures

The parity apparatus exists to prove the native runtime reproduces the legacy
engine. Once the legacy engine is gone it has nothing to compare against:

- **Retire** `tests/lab-workflows/definitions/nativeTitrationParity.test.ts`,
  `titrationParityOracle.test.ts`, `src/lab-workflows/replay/parity.ts`, and
  the golden fixture `tests/lab-workflows/definitions/fixtures/
  titration-parity-oracle.json` in the same commit that deletes the engine.
- **Before** retiring, convert the oracle's behavioral pins that are still
  product truth (endpoint volumes, dilution bias sentences, knife-edge
  dispense arithmetic once §4's raw-float fields are re-pinned) into direct
  native trace-plan cases (`fullTitrationTracePlan.ts` successor), so the
  chemistry stays pinned by tests that do not require the legacy source.
- Verification for the whole phase: `npx vitest run tests/` green with the
  parity files deleted and no remaining import of `src/experiments/titration`.

## 8. Suggested order

1. §5 native report consumer + assignment persistence (unblocks everything).
2. §6 UI deletions with e2e re-authoring; §1 route/param cleanup.
3. §2 store simplification onto generic state.
4. §3 runtime compatibility layer; registry snapshot bumps.
5. §4 engine deletion + raw-float re-pin; §7 oracle retirement (same release).
