# Pedagogical Skill Registry

## Purpose

The skill registry translates teacher learning goals into supported, evidence-bearing lab capabilities. It tells the Lab Authoring Agent which lab families can teach or assess a skill, which components are useful, which engine flags/events can provide evidence, and which assessment, coaching, and retry patterns are allowed.

A skill is authorable only when at least one supported family provides deterministic evidence for it. Text-only discussion prompts may be preserved in a non-runnable outline, but they do not make an unsupported simulation runnable.

## Entry contract

```ts
interface SkillRegistryEntry {
  id: string;
  description: string;
  aliases: readonly string[];
  supportedFamilyIds: readonly string[];
  requiredComponentIds: readonly string[];
  recommendedComponentIds: readonly string[];
  relevantEventFlagIds: readonly string[];
  assessmentModes: readonly string[];
  coachTriggerTypes: readonly string[];
  adaptiveRetryPatternIds: readonly string[];
  examplePrompts: readonly string[];
  availability: "verified" | "planned" | "restricted";
}
```

Availability is derived from implemented registries and engine capability tests. The entries below define target contracts; only entries backed by code and tests may be returned as verified by authoring tools.

## Canonical skills

### `endpoint_control`

- **Description:** Controls delivery rate near a titration endpoint and avoids overshoot.
- **Supported families:** `family.acid_base_titration.v1`.
- **Components:** Required `component.burette.v1`, `component.erlenmeyer_flask.v1`; recommended `component.indicator_bottle.v1`.
- **Relevant flags/evidence:** `flow_rate_high_near_endpoint`, `endpoint_overshoot`; positive evidence `controlled_addition_near_endpoint` is an evidence reason, not a coach-triggering failure flag.
- **Assessment modes:** observed procedure, event-log performance, short reflection, report rubric.
- **Coach trigger types:** reflective question after high flow, procedural hint after repeated high flow, warning after overshoot; stay silent on controlled addition.
- **Adaptive retry:** `retry.endpoint_control_near_endpoint.v1`, starting only from an engine-validated near-endpoint seed.
- **Example prompt:** “Create a 7-minute titration pre-lab focused on endpoint control.”

### `meniscus_reading`

- **Description:** Reads the bottom of a concave meniscus at eye level and records apparatus-appropriate precision.
- **Supported families:** `family.acid_base_titration.v1`; planned `family.measurement.v1` and `family.calorimetry.v1` for cylinder practice.
- **Components:** Required one of `component.burette.v1` or `component.graduated_cylinder.v1`; recommended eye-level focus/explicit entry adapter.
- **Relevant flags/evidence:** `meniscus_misread`, positive evidence reason `meniscus_read_ok`.
- **Assessment modes:** visual reading entry, repeated measurement, event evidence, significant-figure check.
- **Coach trigger types:** observation prompt, graduated eye-level hint, precision hint after a wrong entry; stay silent when within registered tolerance.
- **Adaptive retry:** `retry.meniscus_reading.v1` with several registry-owned liquid levels.
- **Example prompt:** “Give my students a short lab for practicing meniscus reading.”

### `burette_conditioning`

- **Description:** Rinses a burette with the intended titrant before filling and explains the dilution consequence.
- **Supported families:** `family.acid_base_titration.v1`.
- **Components:** Required `component.burette.v1` and `component.reagent_bottle.v1`.
- **Relevant flags/evidence:** `burette_not_conditioned`; positive conditioning evidence from `rinse_burette`.
- **Assessment modes:** observed procedure, sequencing check, short explanation.
- **Coach trigger types:** reflective dilution question after water rinse, protocol hint after repeated error.
- **Adaptive retry:** `retry.burette_conditioning.v1` starting before rinse/fill.
- **Example prompt:** “Make a pre-lab that checks whether students know how to condition a burette.”

### `stoichiometry`

- **Description:** Relates measured quantities through a verified reaction model and balanced mole ratio.
- **Supported families:** `family.acid_base_titration.v1`; planned `family.precipitation_solubility.v1` and `family.calorimetry.v1` only for engine-supported calculations.
- **Components:** Family-dependent; titration requires burette/flask, precipitation recommends measured transfer apparatus, calorimetry may require balance/cylinder.
- **Relevant flags/evidence:** `result_out_of_tolerance` for current titration reporting; family-specific evidence must be registered.
- **Assessment modes:** calculation response, report rubric, evidence-linked explanation.
- **Coach trigger types:** conceptual question, unit/mole-ratio hint, answer-check response using supplied deterministic ground truth.
- **Adaptive retry:** registry-backed calculation scaffold tied to recorded measurements; no AI-generated truth.
- **Example prompt:** “Create a titration workflow that assesses stoichiometry from measured endpoint volume.”

### `significant_figures`

- **Description:** Records measurements and calculated results to precision justified by the apparatus and data.
- **Supported families:** all verified measurement-bearing families.
- **Components:** Any registered measuring component; recommended `component.burette.v1`, `component.graduated_cylinder.v1`, `component.balance.v1`, or `component.thermometer.v1`.
- **Relevant flags/evidence:** Family-specific precision flags must be registered; existing report feedback may use deterministic apparatus precision even when no live coach flag exists.
- **Assessment modes:** data table, report calculation, measurement entry comparison.
- **Coach trigger types:** generally defer to recording/report stage; precision hint after a registered mismatch; stay silent during correct routine actions.
- **Adaptive retry:** `retry.measurement_precision.v1` using registered apparatus/readings.
- **Example prompt:** “Create a five-minute measurement lab about significant figures.”

### `net_ionic_equations`

- **Description:** Writes a balanced net ionic equation and excludes spectator ions using verified reaction/solubility truth.
- **Supported families:** planned `family.precipitation_solubility.v1`; not runnable until that engine and evaluator evidence are verified.
- **Components:** Recommended two reagent bottles or pipettes plus `component.beaker.v1` or `component.erlenmeyer_flask.v1`.
- **Relevant flags/evidence:** Planned `spectator_ion_included`, `charge_not_balanced`, `net_ionic_equation_incorrect`; unavailable until registered/tested.
- **Assessment modes:** structured equation builder, ion classification, report explanation.
- **Coach trigger types:** spectator-ion question, charge-balance hint, observation-to-equation connection.
- **Adaptive retry:** alternate verified reagent pair yielding the same misconception target.
- **Example prompt:** “Create a lab that helps students practice net ionic equations.”

### `precipitate_observation`

- **Description:** Connects a visible precipitate observation to a verified solubility outcome without guessing product identity.
- **Supported families:** planned `family.precipitation_solubility.v1`.
- **Components:** Required mixing vessel plus two compatible reagent-source/transfer components.
- **Relevant flags/evidence:** Planned `precipitate_prediction_incorrect`, `observation_not_recorded`; identity/color are engine observations, not LLM claims.
- **Assessment modes:** observation record, before/after prediction, classification.
- **Coach trigger types:** notice-and-describe prompt, prediction reflection, evidence-versus-claim hint.
- **Adaptive retry:** new verified soluble/insoluble reagent pair.
- **Example prompt:** “Build a mini-lab where students predict and observe a precipitate.”

### `heat_transfer`

- **Description:** Tracks energy transfer between system and surroundings using deterministic calorimetry state.
- **Supported families:** planned `family.calorimetry.v1`.
- **Components:** Required `component.calorimeter.v1` and `component.thermometer.v1`; recommended cylinder or balance based on engine config.
- **Relevant flags/evidence:** Planned `heat_direction_reversed`, `temperature_change_misread`; heat values remain engine-owned.
- **Assessment modes:** temperature data, system/surroundings classification, report explanation.
- **Coach trigger types:** direction-of-transfer question, graph interpretation hint.
- **Adaptive retry:** registry-backed hot/cold mixing scenario with different verified initial conditions.
- **Example prompt:** “Create a calorimetry workflow focused on heat transfer.”

### `calorimetry_sign_convention`

- **Description:** Applies consistent signs for system/surroundings heat and exothermic/endothermic processes.
- **Supported families:** planned `family.calorimetry.v1`.
- **Components:** Required `component.calorimeter.v1` and `component.thermometer.v1`.
- **Relevant flags/evidence:** Planned `heat_sign_reversed`, `system_surroundings_confused`.
- **Assessment modes:** sign-selection check, explanation, report rubric.
- **Coach trigger types:** system-boundary question, sign-convention hint that does not reveal the final numeric result.
- **Adaptive retry:** same deterministic temperature trace with reversed system framing, or a verified contrasting exothermic/endothermic seed.
- **Example prompt:** “Create a calorimetry workflow focused on heat transfer sign conventions.”

### `procedural_safety`

- **Description:** Follows workflow-specific handling and sequencing rules sourced from deterministic safety policies.
- **Supported families:** all verified families, with evidence limited to implemented actions and policies.
- **Components:** Workflow-dependent; restricted components such as `component.heat_source_bunsen.v1` remain unavailable in MVP.
- **Relevant flags/evidence:** Only registered safety flags; validator blockers are not converted into student practice simply by adding coach text.
- **Assessment modes:** sequencing, safe-choice scenario, report reflection.
- **Coach trigger types:** immediate registered safety warning, protocol reminder, refusal of unsafe question.
- **Adaptive retry:** safe-choice micro-scenario using verified components; never a replay of prohibited behavior without a modeled safe state.
- **Example prompt:** “Make a pre-lab that checks safe reagent handling during a titration.”

### `data_recording`

- **Description:** Records observations, units, precision, and timestamps/step context in a usable lab data table.
- **Supported families:** all verified families.
- **Components:** Any measuring/observation component selected by the family.
- **Relevant flags/evidence:** Planned generic flags such as `required_observation_missing` require registry implementation; submitted event/observation keys can also provide deterministic completion evidence.
- **Assessment modes:** structured notebook entries, completeness check, report data table.
- **Coach trigger types:** missing-entry reminder at a step boundary, unit/precision hint, reflection on anomalous data.
- **Adaptive retry:** short measurement-and-record sequence with registry-backed values.
- **Example prompt:** “Create a short lab that practices careful data recording with units.”

## Legacy skill ID compatibility

The current code and persisted rows use some earlier IDs. Migration must preserve historical meaning:

| Existing ID | Canonical composer ID | Rule |
|---|---|---|
| `volumetric_reading` | `meniscus_reading` | Resolve as an alias during migration/analytics; do not rewrite historical raw events in place. |
| `sig_figs` | `significant_figures` | Alias report/evidence queries until versioned migration is complete. |
| `net_ionic_equation` | `net_ionic_equations` | Planned plugin should emit the canonical ID while reading legacy fixtures through alias resolution. |
| `sign_convention` | `calorimetry_sign_convention` | Planned calorimetry plugin uses the canonical ID. |

Alias resolution is deterministic and versioned. The authoring LLM must always receive and return canonical IDs.

## How the authoring agent uses the registry

1. Extract candidate objectives, duration, audience, and assessment intent from the teacher request.
2. Search canonical skills and aliases; return ambiguity rather than silently selecting an unrelated objective.
3. Intersect the skills' verified family sets. MVP workflows select one family only.
4. If the intersection is empty, classify the request as partially supported or unsupported and propose a registry-backed alternative.
5. Select required components first, then recommended components only when they fit time, performance, and family constraints.
6. Select registered event evidence for coach triggers and rubric criteria.
7. Select an adaptive retry only when a compatible template and engine-validated seed exist.
8. Submit the draft to the hard validator; never treat registry search results as proof of final runnability.

The registry helps the agent choose what to assemble. It does not authorize chemistry or bypass the validator.
