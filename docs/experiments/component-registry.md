# Component Registry

> **Version note:** The titration component registry is now implemented, but
> its current entries remain family-coupled and lack the full capability and
> mechanical-adapter contracts. Treat the interfaces below as v1/history where
> they differ from the
> [`capability contract blueprint`](../lab-composer/contract-blueprint.md).
> `LC2-100` evolves this registry in place; do not create a competing equipment
> registry.

## Purpose and status

The component registry defines reusable, verified lab apparatus primitives. A registry entry is eligible for generated workflows only after its state/action contract, visual adapter, accessibility behavior, safety rules, compatibility matrix, and tests exist in code.

The current titration IDs are code-backed only where matching entries and tests exist under `src/lab-workflows/registries/components`. Any additional example remains planned until its exact registry entry, adapter, behavior, and tests exist. Existing titration equipment must evolve without changing the titration truth layer.

Components own apparatus interaction and presentation contracts. They must not contain experiment-specific chemistry formulas, choose precipitates, calculate pH, compute heat flow, or grade answers. A component dispatches a registered typed action; an experiment engine determines the consequence and emits semantic events.

## Entry contract

Every implemented entry must declare:

```ts
interface ComponentRegistryEntry<TState> {
  id: string;
  version: string;
  purpose: string;
  stateSchema: unknown;
  allowedActionIds: readonly string[];
  emittedEventTypes: readonly string[];
  measurement: MeasurementCapability | null;
  visualAdapterId: string;
  accessibilityRequirements: readonly string[];
  safetyConstraintIds: readonly string[];
  compatibleFamilyIds: readonly string[];
  performanceTier: "core" | "enhanced" | "restricted";
}
```

The runtime owns component state. A workflow may select a registry-backed configuration preset and placement slot, but may not inject arbitrary initial state.

## `component.burette.v1`

- **Purpose:** Accurately contain, condition, dispense, and read titrant in volumetric workflows.
- **State shape:** `{ capacityML; availableML; deliveredML; conditionedWith; filled; stopcockDetent; meniscusReadingML }`. The runtime/engine projection owns values; the workflow supplies only validated capacity/configuration IDs.
- **Allowed actions:** `action.rinse.v1`, `action.fill.v1`, `action.set_flow_rate.v1`, `action.dispense.v1`, `action.read_volume.v1`.
- **Emitted semantic events:** `rinse_burette`, `fill_burette`, `add_titrant`, `read_meniscus`; associated registered flags may include `burette_not_conditioned`, `flow_rate_high_near_endpoint`, `endpoint_overshoot`, and `meniscus_misread` when emitted by the selected engine.
- **Measurement precision:** 50.00 mL class-A-style virtual burette; 0.10 mL graduations, read/record to 0.05 mL for the MVP contract. Full engine precision remains separate from displayed precision.
- **Visual requirements:** Full tube, graduations, concave meniscus bottom, stopcock, tip, and receiving vessel must remain readable in the focused pose; keyboard and explicit 2D precision controls are required; reduced-graphics mode must preserve measurement legibility.
- **Safety constraints:** Clamp capacity and flow to registry limits; prevent dispensing without a compatible receiving container; block incompatible/corrosive reagent profiles; never present a virtual procedure as a waiver of real PPE/training.
- **Compatible families:** `family.acid_base_titration.v1`; future volumetric-analysis families only after explicit compatibility tests.
- **Workflow example:** Instance `titrant_burette` uses this component with a verified 50 mL preset and permits dropwise dispense during the endpoint-control step.

## `component.erlenmeyer_flask.v1`

- **Purpose:** Receive, contain, swirl, and visually expose reactions while reducing splash risk compared with an open beaker.
- **State shape:** `{ capacityML; containedReagentInstanceIds; totalVolumeML; observableColor; precipitateAppearance; temperatureC; isSwirling }`. Chemistry projections come from the engine.
- **Allowed actions:** `action.receive_transfer.v1`, `action.add_indicator.v1`, `action.swirl.v1`, `action.mix.v1`, `action.record_observation.v1`.
- **Emitted semantic events:** `receive_transfer`, `add_indicator`, `swirl`, `mix`, `submit_observation`; reaction-specific observations/flags are engine-emitted.
- **Measurement precision:** Flask graduations are approximate and must not be used for quantitative delivery; proposed 25 mL markings carry ±5 mL visual estimation only.
- **Visual requirements:** Visible liquid level, color/precipitate projection, stable focus target, readable approximate graduations, and no requirement for high-cost fluid physics.
- **Safety constraints:** Enforce capacity/headspace limits; prevent incompatible virtual reagent combinations and transfers from restricted heat sources; require a registered receiving role.
- **Compatible families:** `family.acid_base_titration.v1`, `family.precipitation_solubility.v1`; calorimetry only as an external transfer vessel, not the calorimeter itself.
- **Workflow example:** Instance `analyte_flask` receives the analyte preset, indicator, and titrant; the titration engine owns color and endpoint behavior.

## `component.beaker.v1`

- **Purpose:** General mixing, holding, and coarse-volume transfer.
- **State shape:** `{ capacityML; totalVolumeML; containedReagentInstanceIds; observableColor; precipitateAppearance; temperatureC }`.
- **Allowed actions:** `action.receive_transfer.v1`, `action.transfer_volume.v1`, `action.mix.v1`, `action.record_observation.v1`.
- **Emitted semantic events:** `receive_transfer`, `transfer_volume`, `mix`, `submit_observation` plus engine observation events.
- **Measurement precision:** Coarse only. A 100 mL beaker with 10 mL graduations should be read no more precisely than ±5 mL; validator rejects workflows that require volumetric-grade precision.
- **Visual requirements:** Legible capacity/approximate graduations, liquid/solid observation projection, low-poly geometry, keyboard selection, and reduced-graphics parity.
- **Safety constraints:** Capacity/headspace enforcement; no use as a precision delivery device; reagent and heating compatibility must resolve through safety policies.
- **Compatible families:** `family.precipitation_solubility.v1`, `family.calorimetry.v1`, `family.measurement.v1`; limited preparation use in titration.
- **Workflow example:** Instances `solution_a_beaker` and `solution_b_beaker` hold verified ionic solutions before a registered mix action.

## `component.pipette.v1`

- **Purpose:** Deliver a verified fixed or bounded liquid aliquot with higher precision than a cylinder or beaker.
- **State shape:** `{ mode; nominalVolumeML; loadedVolumeML; sourceReagentInstanceId; conditioned; drained }`.
- **Allowed actions:** `action.condition_pipette.v1`, `action.aspirate.v1`, `action.transfer_volume.v1`, `action.drain.v1`.
- **Emitted semantic events:** `condition_pipette`, `aspirate`, `transfer_volume`, `drain_pipette`; planned flags require registry/tests before use.
- **Measurement precision:** Preset-dependent. Example volumetric 10.00 mL preset has a registry-defined tolerance (target ±0.02 mL); workflows may not author their own tolerance.
- **Visual requirements:** Bulb/tip, fill indication, source/destination focus, explicit 2D transfer control, and accessible status text.
- **Safety constraints:** No mouth pipetting interaction; only compatible liquids and volumes; no overfill; enforce source/destination roles.
- **Compatible families:** `family.acid_base_titration.v1`, `family.precipitation_solubility.v1`, `family.calorimetry.v1`, `family.measurement.v1` once adapters exist.
- **Workflow example:** Instance `analyte_pipette` transfers a registered 10.00 mL analyte aliquot into `analyte_flask`.

## `component.graduated_cylinder.v1`

- **Purpose:** Measure and transfer moderate liquid volumes with intermediate precision.
- **State shape:** `{ capacityML; containedVolumeML; reagentInstanceId; meniscusReadingML }`.
- **Allowed actions:** `action.fill.v1`, `action.read_volume.v1`, `action.transfer_volume.v1`.
- **Emitted semantic events:** `fill_graduated_cylinder`, `read_meniscus`, `transfer_volume`; the engine/event adapter emits precision evidence.
- **Measurement precision:** Preset-defined. A 50 mL cylinder with 1 mL graduations is read to 0.5 mL; validator rejects a rubric requiring burette-level precision.
- **Visual requirements:** Tall stable silhouette, readable graduations/meniscus, eye-level focus, explicit numeric entry alternative, reduced-graphics legibility.
- **Safety constraints:** Enforce capacity, compatible liquids, and stable placement; prohibit direct heating.
- **Compatible families:** `family.calorimetry.v1`, `family.measurement.v1`, selected preparation/precipitation workflows.
- **Workflow example:** Instance `water_cylinder` asks the student to read 35.5 mL before transferring it to a calorimeter.

## `component.reagent_bottle.v1`

- **Purpose:** Hold and identify a verified reagent profile and serve as a transfer source.
- **State shape:** `{ reagentInstanceId; capacityML; availableVolumeML; capState; labelState }`.
- **Allowed actions:** `action.inspect_label.v1`, `action.open_close.v1`, `action.transfer_volume.v1`, `action.rinse.v1` where the selected family allows it.
- **Emitted semantic events:** `inspect_reagent_label`, `open_reagent_bottle`, `transfer_volume`, `rinse_burette` through the relevant action adapter.
- **Measurement precision:** Not a measuring device. Delivered amount is controlled/measured by the destination apparatus or registered transfer preset.
- **Visual requirements:** High-contrast label with name/concentration/hazard cues supplied from registry data, distinct cap, keyboard focus, and no text baked into expensive external models.
- **Safety constraints:** A bottle binds exactly one reagent registry entry; incompatible transfer, unlabeled use, and restricted profiles are blocked; real-world hazard language comes from registry data, not the LLM.
- **Compatible families:** Any family explicitly allowed by the bound reagent and engine.
- **Workflow example:** Instance `titrant_source` binds a verified sodium-hydroxide profile and may rinse/fill `titrant_burette`.

## `component.indicator_bottle.v1`

- **Purpose:** Hold and dispense a verified indicator profile in bounded drops.
- **State shape:** `{ indicatorReagentInstanceId; availableDrops; selected; capState }`.
- **Allowed actions:** `action.inspect_label.v1`, `action.select_indicator.v1`, `action.add_indicator.v1`.
- **Emitted semantic events:** `select_indicator`, `add_indicator`; indicator suitability evidence is emitted by the titration engine if supported.
- **Measurement precision:** Drop count only; the registry defines a bounded drop-volume preset, not a student volumetric measurement.
- **Visual requirements:** Distinguishable color cap plus text label, selected-bottle affordance, focus/keyboard parity, and observable drop count/status.
- **Safety constraints:** Only registered indicator profiles; bounded dose; no arbitrary substitution or tasting/skin-contact interaction.
- **Compatible families:** `family.acid_base_titration.v1`; other colorimetric families only after engine support.
- **Workflow example:** `phenolphthalein_bottle` binds the registered indicator profile and permits `add_indicator` before titration begins.

## `component.balance.v1`

- **Purpose:** Measure mass and support tare/container workflows.
- **State shape:** `{ capacityG; readabilityG; tareG; sampleMassG; displayMassG; stable }`.
- **Allowed actions:** `action.tare.v1`, `action.place_sample.v1`, `action.read_mass.v1`, `action.remove_sample.v1`.
- **Emitted semantic events:** `tare_balance`, `place_sample`, `read_mass`, `remove_sample`; significant-figure/failed-tare flags require registered engine/event coverage.
- **Measurement precision:** Preset-defined; proposed Chromebook MVP digital balance reads to 0.01 g within a registry-owned capacity/tolerance.
- **Visual requirements:** Large accessible digital readout, tare control, stable/unstable state text, keyboard use, and no continuous high-cost physics.
- **Safety constraints:** Capacity enforcement; require a compatible weighing container; no arbitrary hazardous solids; virtual handling does not replace real balance training.
- **Compatible families:** `family.calorimetry.v1`, `family.measurement.v1`; future stoichiometry families after verification.
- **Workflow example:** `sample_balance` requires tare, then records a mass event used by the deterministic calorimetry configuration.

## `component.thermometer.v1`

- **Purpose:** Measure temperature over time in a compatible vessel.
- **State shape:** `{ rangeC; readabilityC; measuredTemperatureC; probeTargetId; equilibrated; sampleTimes }`.
- **Allowed actions:** `action.place_probe.v1`, `action.wait_for_equilibrium.v1`, `action.read_temperature.v1`, `action.remove_probe.v1`.
- **Emitted semantic events:** `place_thermometer`, `temperature_equilibrated`, `read_temperature`, `remove_thermometer`; heat/sign evidence remains engine-owned.
- **Measurement precision:** Proposed digital preset reads to 0.1 °C; response lag/tolerance must be deterministic configuration, never authored ad hoc.
- **Visual requirements:** Legible display, visible probe target, time/curve projection when supplied by the engine, accessible numeric representation.
- **Safety constraints:** Temperature/range limits; compatible vessel; prevent impossible probe placement and restricted heat-source use.
- **Compatible families:** `family.calorimetry.v1`, `family.measurement.v1`.
- **Workflow example:** `calorimeter_probe` records initial and final readings supplied by `engine.calorimetry.v1` when that engine becomes verified.

## `component.calorimeter.v1`

- **Purpose:** Provide an insulated mixing vessel and measurement context for coffee-cup calorimetry.
- **State shape:** `{ capacityML; containedReagentInstanceIds; totalMassG; temperatureC; lidState; probeInserted; mixed }`; temperature and heat behavior are engine projections.
- **Allowed actions:** `action.receive_transfer.v1`, `action.insert_lid.v1`, `action.place_probe.v1`, `action.mix.v1`, `action.read_temperature.v1`.
- **Emitted semantic events:** `fill_calorimeter`, `insert_lid`, `mix`, `read_temperature`; heat-transfer/sign flags require the verified calorimetry engine.
- **Measurement precision:** The vessel itself is not volumetric. Temperature precision comes from the registered thermometer; calorimeter constant comes from an engine configuration profile.
- **Visual requirements:** Cup/lid/probe state, readable contents/temperature, low-poly insulation cue, no simulated heat particles required.
- **Safety constraints:** Enforce temperature, capacity, lid, and reagent compatibility; prohibit flame/direct heating; no arbitrary calorimeter constant in generated specs.
- **Compatible families:** `family.calorimetry.v1` only after deterministic engine and seed tests exist.
- **Workflow example:** `coffee_cup_calorimeter` uses a registered constant/configuration and accepts two compatible water/solution transfers.

## `component.heat_source_bunsen.v1` — restricted/future

- **Purpose:** Potential future representation of controlled heating; it is not an MVP runnable primitive.
- **State shape:** Future contract only: `{ fuelState; ignitionState; flameSetting; targetId; elapsedS }`. No entry should be marked available until a deterministic heat/safety model exists.
- **Allowed actions:** None in MVP. Future candidates such as ignite, adjust flame, and extinguish must be registry-backed and safety-gated.
- **Emitted semantic events:** None in MVP. Proposed heating/safety events cannot be referenced until registered and tested.
- **Measurement precision:** Not a measuring device; heat flow must come from a verified engine, never a visual animation or LLM estimate.
- **Visual requirements:** If implemented, obvious on/off state, accessible nonvisual state, emergency stop, low-cost flame representation, and Chromebook performance tests.
- **Safety constraints:** `safety.no_open_flame_mvp.v1` makes this component unsupported/rejected for the Chromebook MVP. It requires explicit teacher/school policy, safety model, compatible apparatus/reagents, and emergency-state tests before any future activation.
- **Compatible families:** None in MVP.
- **Workflow example:** A teacher request for an open-flame lab resolves to `unsupported` or `rejected_for_safety`; no runnable component instance is created.

## Compatibility and verification rules

- Component IDs are exact and versioned; no fuzzy runtime fallback.
- A component is not “verified” merely because a 3D model exists.
- Every allowed action must resolve in the action registry and selected engine adapter.
- Every claimed semantic event/flag must be emitted by deterministic code and covered by tests.
- Component measurement limits constrain workflow rubrics and expected observations.
- Restricted/future entries remain discoverable for honest capability reporting but are never eligible for runtime assembly.
- A component registry change requires schema/compatibility tests and at least one affected seed workflow replay.
